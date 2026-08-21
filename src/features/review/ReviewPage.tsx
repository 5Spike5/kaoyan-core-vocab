import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Volume2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { searchExamCorpus } from "../../data/corpusIndex";
import { publicVocab } from "../../data/publicVocab";
import { normalizeTerm } from "../../lib/normalizeTerm";
import { speakWord } from "../../lib/tts";
import { runAutoCloudSync } from "../../repositories/cloudSync";
import { createLocalRepository } from "../../repositories/localRepository";
import type { UserWord } from "../../types/domain";
import { lookupWithCache } from "../lookup/dictionaryApi";
import { createDictionaryProvider } from "../lookup/dictionaryProvider";
import { calculateTodayStudyMinutes } from "../stats/statsSelectors";
import { mergePublicAndUserWords } from "../vocab/vocabService";
import {
  applyWordReview,
  buildReviewOptions,
  createReviewLog,
} from "./reviewService";
import type { ReviewOption, ReviewRating } from "./reviewTypes";

const LOCAL_USER_ID = "local";
const GOAL_KEY = "kaoyan-daily-goal";
const NEW_WORD_ROUNDS = 3;
const NEW_WORD_DIRECTIONS: Array<"e2c" | "c2e"> = ["e2c", "c2e", "e2c"];
const REVIEW_CAP = 50;
const FREE_CAP = 20;

type Direction = "e2c" | "c2e";

type DeckItem = {
  id: string;
  word: {
    id: string;
    term: string;
    meaning: string;
    fsrs: UserWord["fsrs"];
  };
  direction: Direction;
};

const OPTION_LETTERS = ["A", "B", "C", "D"];

const MODE_LABELS: Record<string, string> = {
  today: "今日背诵",
  due: "强制复习",
  free: "自主复习",
};

const MODE_BADGES: Record<string, string> = {
  today: "new",
  due: "review",
  free: "learning",
};

const RATINGS: Array<{
  value: ReviewRating;
  label: string;
  interval: string;
  className: string;
}> = [
  { value: "again", label: "Again", interval: "1分钟", className: "again" },
  { value: "hard", label: "Hard", interval: "10分钟", className: "hard" },
  { value: "good", label: "Good", interval: "1天", className: "good" },
  { value: "easy", label: "Easy", interval: "4天", className: "easy" },
];

function loadGoal(): number {
  const saved = Number(localStorage.getItem(GOAL_KEY));
  return [60, 80, 100, 120].includes(saved) ? saved : 80;
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function orderOptions(options: ReviewOption[], term: string) {
  const offset = term.length % options.length;
  return [...options.slice(offset), ...options.slice(0, offset)];
}

function buildDeck(words: UserWord[], mode: string, goal: number): DeckItem[] {
  const meaningOf = (word: UserWord) => word.meanings[0]?.text ?? "";
  const hasMeaning = (word: UserWord) => Boolean(meaningOf(word));

  if (mode === "today") {
    const newWords = words
      .filter((word) => word.status === "new" && hasMeaning(word))
      .slice(0, goal);
    const items: DeckItem[] = [];
    for (const word of newWords) {
      for (let round = 0; round < NEW_WORD_ROUNDS; round += 1) {
        items.push({
          id: `${word.normalizedTerm}#r${round}`,
          word: {
            id: word.id,
            term: word.term,
            meaning: meaningOf(word),
            fsrs: word.fsrs,
          },
          direction: NEW_WORD_DIRECTIONS[round % NEW_WORD_DIRECTIONS.length],
        });
      }
    }
    return items;
  }

  const now = Date.now();
  const pool =
    mode === "due"
      ? words.filter(
          (word) =>
            word.nextReviewAt !== null &&
            word.nextReviewAt <= now &&
            hasMeaning(word),
        )
      : words.filter(
          (word) =>
            ["learning", "reviewing", "mastered"].includes(word.status) &&
            hasMeaning(word),
        );
  const cap = mode === "due" ? REVIEW_CAP : FREE_CAP;

  return shuffle(pool)
    .slice(0, cap)
    .map((word) => ({
      id: `${word.normalizedTerm}#review`,
      word: {
        id: word.id,
        term: word.term,
        meaning: meaningOf(word),
        fsrs: word.fsrs,
      },
      direction: "e2c" as const,
    }));
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function useReviewKeyboard(input: {
  answered: boolean;
  options: ReviewOption[];
  onSelect(index: number): void;
  onAdvance(): void;
  onExit(): void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key >= "1" && event.key <= "4" && !input.answered) {
        input.onSelect(Number(event.key) - 1);
      }

      const letterIndex = OPTION_LETTERS.indexOf(event.key.toUpperCase());
      if (letterIndex >= 0 && !input.answered) {
        input.onSelect(letterIndex);
      }

      if ((event.key === "Enter" || event.key === " ") && input.answered) {
        event.preventDefault();
        input.onAdvance();
      }

      if (event.key === "Escape") {
        input.onExit();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [input]);
}

export default function ReviewPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") ?? "today";

  const [words, setWords] = useState<UserWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [exampleOpen, setExampleOpen] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [phonetic, setPhonetic] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [summary, setSummary] = useState<{
    todayMinutes: number;
    totalMinutes: number;
  } | null>(null);

  // 新词模式：记录每个词 3 遍的整体对错，用于最后的 FSRS 评级
  const wordResultsRef = useRef(
    new Map<string, { correct: number; total: number }>(),
  );
  const questionStartRef = useRef(Date.now());

  const goal = loadGoal();
  const isNewWordMode = mode === "today";

  const loadWords = useCallback(async () => {
    const repository = createLocalRepository();
    try {
      const userWords = await repository.listUserWords(LOCAL_USER_ID);
      setWords(mergePublicAndUserWords(publicVocab, userWords));
    } finally {
      await repository.close();
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadWords().finally(() => {
      if (!cancelled) {
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loadWords]);

  const deck = useMemo(() => buildDeck(words, mode, goal), [words, mode, goal]);
  const item = deck[currentIndex];
  const answered = selectedIndex !== null;

  const options = useMemo(() => {
    if (!item) {
      return [];
    }
    const wordsWithMeaning = words.filter((word) => word.meanings[0]?.text);
    const current =
      item.direction === "e2c"
        ? { term: item.word.term, meaning: item.word.meaning }
        : { term: item.word.meaning, meaning: item.word.term };
    const candidates =
      item.direction === "e2c"
        ? wordsWithMeaning.map((word) => ({
            term: word.term,
            meaning: word.meanings[0]!.text,
          }))
        : wordsWithMeaning.map((word) => ({
            term: word.meanings[0]!.text,
            meaning: word.term,
          }));
    return orderOptions(
      buildReviewOptions(current, candidates),
      item.word.term,
    );
  }, [item, words]);

  const selectedOption = selectedIndex === null ? null : options[selectedIndex];
  const isCorrect = selectedOption?.isCorrect ?? false;
  const example = item
    ? searchExamCorpus(item.word.term).examples[0]
    : undefined;

  const modeLabel = MODE_LABELS[mode] ?? MODE_LABELS.today;
  const modeBadge = MODE_BADGES[mode] ?? "new";
  const fsrsInfo = useMemo(() => {
    const fsrs = item?.word.fsrs;
    if (!fsrs) {
      return null;
    }
    return {
      stability: Math.round(fsrs.stability),
      difficulty: Math.round(fsrs.difficulty * 10) / 10,
      reps: fsrs.reps,
    };
  }, [item]);

  // 音标：异步从公共词典补充，失败时静默隐藏
  useEffect(() => {
    if (!item) {
      return;
    }
    let cancelled = false;
    setPhonetic(null);
    const provider = createDictionaryProvider();
    void lookupWithCache(item.word.term, provider)
      .then((result) => {
        if (!cancelled && result.phonetic) {
          setPhonetic(result.phonetic);
        }
      })
      .catch(() => {
        // 词典不可用时仅不显示音标
      });
    return () => {
      cancelled = true;
    };
  }, [item]);

  // 每次作答后自动朗读一次当前单词
  useEffect(() => {
    if (!answered || !item) {
      return;
    }
    speakWord(item.word.term);
  }, [answered, item]);

  // 学习计时
  useEffect(() => {
    if (completed) {
      return;
    }
    const timer = window.setInterval(
      () => setElapsed((value) => value + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [completed]);

  // 完成页的今日/累计时长
  useEffect(() => {
    if (!completed) {
      return;
    }
    let cancelled = false;
    const repository = createLocalRepository();
    void Promise.all([
      repository.listReviewLogs("local"),
      repository.listStudySessions("local"),
    ])
      .then(([logs, sessions]) => {
        if (cancelled) {
          return;
        }
        setSummary({
          todayMinutes: calculateTodayStudyMinutes(logs, sessions),
          totalMinutes: Math.round(
            logs.reduce((total, log) => total + log.elapsedMs, 0) / 60000,
          ),
        });
      })
      .catch(() => {
        if (!cancelled) {
          setSummary({ todayMinutes: 0, totalMinutes: 0 });
        }
      })
      .finally(() => {
        void repository.close();
      });
    return () => {
      cancelled = true;
    };
  }, [completed]);

  /** 把一次评分写回本地：更新 FSRS 卡片 + 状态 + 下次复习时间，并记录复习日志。 */
  const writeBackWord = useCallback(
    async (
      wordId: string,
      rating: ReviewRating,
      answeredCorrectly: boolean,
      elapsedMs: number,
    ) => {
      const word = words.find((entry) => entry.id === wordId);
      if (!word) {
        return;
      }
      const repository = createLocalRepository();
      try {
        const updated = applyWordReview(word, rating);
        await repository.upsertUserWord(updated);
        await repository.appendReviewLog(
          createReviewLog({
            word: updated,
            rating,
            answeredCorrectly,
            elapsedMs,
          }),
        );
      } finally {
        await repository.close();
      }
    },
    [words],
  );

  /** 新词模式：单词 3 遍结束后按整体表现评级（全对 → good，有错 → again）。 */
  const finalizeWord = useCallback(
    async (wordId: string) => {
      const result = wordResultsRef.current.get(wordId);
      if (!result || result.total === 0) {
        return;
      }
      wordResultsRef.current.delete(wordId);
      const rating: ReviewRating =
        result.correct === result.total ? "good" : "again";
      await writeBackWord(wordId, rating, result.correct === result.total, 0);
    },
    [writeBackWord],
  );

  /** 完成后自动把本地进度同步到云端账号（静默失败，可手动重试）。 */
  const autoSyncToCloud = useCallback(async () => {
    try {
      await runAutoCloudSync({ notify: true });
    } catch {
      // 网络或权限失败时静默，之后可在设置页手动同步
    }
  }, []);

  const persistSession = useCallback(
    async (completedAt: number | null) => {
      try {
        const repository = createLocalRepository();
        await repository.upsertStudySession({
          id: "local-review-session",
          userId: "local",
          mode: mode === "today" ? "new" : mode === "due" ? "due" : "free",
          wordIds: [...new Set(deck.map((deckItem) => deckItem.word.id))],
          currentIndex,
          startedAt: Date.now() - elapsed * 1000,
          completedAt,
        });
        await repository.close();
      } catch {
        // Local persistence should not block review navigation.
      }
    },
    [currentIndex, deck, elapsed, mode],
  );

  const handleExit = useCallback(() => {
    if (isNewWordMode && item) {
      void finalizeWord(item.word.id);
    }
    void persistSession(null);
    navigate("/");
  }, [finalizeWord, isNewWordMode, item, navigate, persistSession]);

  const handleFinish = useCallback(() => {
    void persistSession(Date.now());
    setCompleted(true);
    void autoSyncToCloud();
  }, [autoSyncToCloud, persistSession]);

  const handleAdvance = useCallback(() => {
    if (!answered) {
      return;
    }

    const nextIndex = currentIndex + 1;
    const current = deck[currentIndex];
    const next = deck[nextIndex];

    // 新词模式：当前词的最后一遍结束后写回
    if (
      isNewWordMode &&
      current &&
      (!next || next.word.id !== current.word.id)
    ) {
      void finalizeWord(current.word.id);
    }

    if (nextIndex >= deck.length) {
      handleFinish();
      return;
    }

    setCurrentIndex(nextIndex);
    setSelectedIndex(null);
    setExampleOpen(false);
    questionStartRef.current = Date.now();
  }, [answered, currentIndex, deck, finalizeWord, handleFinish, isNewWordMode]);

  const handleSelect = useCallback(
    (index: number) => {
      if (answered) {
        return;
      }
      setSelectedIndex(index);
      if (options[index]?.isCorrect) {
        setCorrectCount((value) => value + 1);
      } else {
        setWrongCount((value) => value + 1);
      }

      const entry = wordResultsRef.current.get(item!.word.id) ?? {
        correct: 0,
        total: 0,
      };
      entry.total += 1;
      if (options[index]?.isCorrect) {
        entry.correct += 1;
      }
      wordResultsRef.current.set(item!.word.id, entry);
    },
    [answered, item, options],
  );

  const handleRate = useCallback(
    (rating: ReviewRating) => {
      if (!answered || !item) {
        return;
      }
      const elapsedMs = Date.now() - questionStartRef.current;
      void writeBackWord(item.word.id, rating, isCorrect, elapsedMs);
      handleAdvance();
    },
    [answered, handleAdvance, isCorrect, item, writeBackWord],
  );

  useReviewKeyboard({
    answered,
    options,
    onSelect: handleSelect,
    onAdvance: handleAdvance,
    onExit: handleExit,
  });

  if (loading) {
    return (
      <section className="page review-page">
        <p className="page-note">正在准备学习内容…</p>
      </section>
    );
  }

  if (deck.length === 0) {
    const emptyMessage =
      mode === "today"
        ? "今天没有新词了，明天再来巩固。"
        : mode === "due"
          ? "暂时没有到期复习的单词。"
          : "还没有已学单词，先去「今日背诵」学习新词吧。";
    return (
      <section className="page review-page">
        <div className="complete-view">
          <div className="complete-icon" aria-hidden="true">
            <CheckCircle2 size={36} />
          </div>
          <h2 className="complete-title">没有可学习的内容</h2>
          <p className="complete-subtitle">{emptyMessage}</p>
          <button type="button" className="btn-continue" onClick={handleExit}>
            返回首页
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </section>
    );
  }

  if (completed) {
    const total = correctCount + wrongCount;
    const accuracy = total === 0 ? 0 : Math.round((correctCount / total) * 100);
    return (
      <section className="page review-page" aria-labelledby="complete-title">
        <div className="complete-view">
          <div className="complete-icon" aria-hidden="true">
            <CheckCircle2 size={36} />
          </div>
          <h2 className="complete-title" id="complete-title">
            学习完成
          </h2>
          <p className="complete-subtitle">今天又完成了一组学习</p>

          <div className="complete-stats" aria-label="本次结果">
            <div className="complete-stat correct">
              <strong>{correctCount}</strong>
              <span>正确</span>
            </div>
            <div className="complete-stat wrong">
              <strong>{wrongCount}</strong>
              <span>错误</span>
            </div>
            <div className="complete-stat">
              <strong>{total}</strong>
              <span>总数</span>
            </div>
          </div>

          <div className="complete-rate">正确率 {accuracy}%</div>

          <div className="complete-times" aria-label="学习时长">
            <div>
              <span>本次学习</span>
              <b>{formatTime(elapsed)}</b>
            </div>
            <div>
              <span>今日学习</span>
              <b>{summary ? `${summary.todayMinutes} 分钟` : "…"}</b>
            </div>
            <div>
              <span>累计学习</span>
              <b>{summary ? `${summary.totalMinutes} 分钟` : "…"}</b>
            </div>
          </div>

          <p className="complete-note">
            {isNewWordMode
              ? "新词已学完，明天记得回来复习"
              : "这些单词将在明天进入复习"}
          </p>

          <button type="button" className="btn-continue" onClick={handleExit}>
            返回首页
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </section>
    );
  }

  const isC2E = item?.direction === "c2e";

  return (
    <section className="page review-page" aria-labelledby="review-title">
      <div className="study-topbar">
        <button
          type="button"
          className="back-btn"
          aria-label="退出学习"
          onClick={handleExit}
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <div className="study-progress">
          {currentIndex + 1} / {deck.length}
        </div>
        <div className="study-timer">
          <Clock size={14} aria-hidden="true" />
          {formatTime(elapsed)}
        </div>
        <span className="pass-badge">{modeLabel}</span>
      </div>

      <div className="study-bar" aria-hidden="true">
        <div
          className="study-bar-fill"
          style={{
            width: `${((currentIndex + (answered ? 1 : 0)) / deck.length) * 100}%`,
          }}
        />
      </div>

      <div className="word-card" key={item?.id}>
        <span className={`word-status-badge ${modeBadge}`}>
          {isNewWordMode ? "新词" : mode === "due" ? "复习中" : "学习中"}
        </span>

        {isC2E ? (
          <h1 className="word-main" id="review-title">
            {item?.word.meaning}
          </h1>
        ) : (
          <>
            <h1 className="word-main" id="review-title">
              {item?.word.term}
            </h1>
            {phonetic ? <div className="word-phonetic">{phonetic}</div> : null}
            <div className="word-speak-row">
              <button
                type="button"
                className={`speak-btn ${speaking ? "speaking" : ""}`}
                aria-label={`朗读 ${item?.word.term ?? ""}`}
                onClick={() => item && speakWord(item.word.term, setSpeaking)}
              >
                <Volume2 size={20} aria-hidden="true" />
              </button>
            </div>
          </>
        )}

        {fsrsInfo ? (
          <div className="word-fsrs" aria-label="FSRS 信息">
            <span>
              稳定性 <b>{fsrsInfo.stability}天</b>
            </span>
            <span>
              难度 <b>{fsrsInfo.difficulty}</b>
            </span>
            <span>
              复习次数 <b>{fsrsInfo.reps}</b>
            </span>
          </div>
        ) : null}
      </div>

      <div className="question-card">
        <p className="question-text">
          {isC2E
            ? `「${item?.word.meaning}」对应的英文单词是？`
            : `「${item?.word.term}」的中文释义是什么？`}
        </p>
        <p className="question-hint">按 A–D 或 1–4 选择答案</p>
      </div>

      <div className="option-grid" aria-label="答案选项">
        {options.map((option, index) => {
          const selected = selectedIndex === index;
          const stateClass = answered
            ? option.isCorrect
              ? "option-correct"
              : selected
                ? "option-wrong"
                : ""
            : "";

          return (
            <button
              key={`${option.sourceTerm}-${option.meaning}`}
              type="button"
              className={`answer-option ${stateClass}`}
              disabled={answered}
              onClick={() => handleSelect(index)}
            >
              <span>{OPTION_LETTERS[index]}</span>
              <strong>{option.meaning}</strong>
            </button>
          );
        })}
      </div>

      {answered ? (
        <div
          className={`result-banner ${isCorrect ? "correct" : "wrong"}`}
          role="status"
        >
          {isCorrect ? (
            <CheckCircle2 size={20} aria-hidden="true" />
          ) : (
            <XCircle size={20} aria-hidden="true" />
          )}
          <p>
            {isCorrect ? "回答正确 · " : "回答错误 · "}
            正确答案：
            <strong>{isC2E ? item?.word.term : item?.word.meaning}</strong>
          </p>
        </div>
      ) : null}

      {example ? (
        <>
          <button
            type="button"
            className={`example-toggle ${exampleOpen ? "revealed" : ""}`}
            onClick={() => setExampleOpen((value) => !value)}
          >
            {exampleOpen ? "收起例句" : "查看例句"}
          </button>
          {exampleOpen ? (
            <div className="example-box" role="note">
              <p className="example-label">真题例句</p>
              <p className="example-en">{example.sentence}</p>
              {example.translation ? (
                <p className="example-cn">{example.translation}</p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {answered && !isNewWordMode ? (
        <div className="rating-row" aria-label="FSRS 评分">
          {RATINGS.map((rating) => (
            <button
              key={rating.value}
              type="button"
              className={`rating-btn ${rating.className}`}
              onClick={() => handleRate(rating.value)}
            >
              <strong>{rating.label}</strong>
              <span>{rating.interval}</span>
            </button>
          ))}
        </div>
      ) : null}

      {answered ? (
        <button type="button" className="btn-continue" onClick={handleAdvance}>
          {isNewWordMode ? "下一题" : "继续"}
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      ) : null}
    </section>
  );
}
