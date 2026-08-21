import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Volume2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { searchExamCorpus } from "../../data/corpusIndex";
import { publicVocab } from "../../data/publicVocab";
import { normalizeTerm } from "../../lib/normalizeTerm";
import { speakWord } from "../../lib/tts";
import { createLocalRepository } from "../../repositories/localRepository";
import { lookupWithCache } from "../lookup/dictionaryApi";
import { createDictionaryProvider } from "../lookup/dictionaryProvider";
import { calculateTodayStudyMinutes } from "../stats/statsSelectors";
import { buildReviewOptions, rateReviewAnswer } from "./reviewService";
import type { ReviewOption } from "./reviewTypes";

type ReviewCard = {
  id: string;
  term: string;
  meaning: string;
};

const sampleCards: ReviewCard[] = [
  { id: "address", term: "address", meaning: "处理，应对" },
  { id: "account-for", term: "account for", meaning: "占比，占据" },
];

const optionCandidates = [
  { term: "address", meaning: "处理，应对" },
  { term: "fetch", meaning: "售得" },
  { term: "bid", meaning: "出价" },
  { term: "peak", meaning: "顶峰" },
  { term: "account for", meaning: "占比，占据" },
  { term: "crucial", meaning: "至关重要的" },
];

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
  value: string;
  label: string;
  interval: string;
  className: string;
}> = [
  { value: "again", label: "Again", interval: "1分钟", className: "again" },
  { value: "hard", label: "Hard", interval: "10分钟", className: "hard" },
  { value: "good", label: "Good", interval: "1天", className: "good" },
  { value: "easy", label: "Easy", interval: "4天", className: "easy" },
];

function orderOptions(options: ReviewOption[], term: string) {
  const offset = term.length % options.length;
  return [...options.slice(offset), ...options.slice(0, offset)];
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

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [exampleOpen, setExampleOpen] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [phonetic, setPhonetic] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [fsrsInfo, setFsrsInfo] = useState<{
    stability: number;
    difficulty: number;
    reps: number;
  } | null>(null);
  const [summary, setSummary] = useState<{
    todayMinutes: number;
    totalMinutes: number;
  } | null>(null);

  const currentCard =
    sampleCards[Math.min(currentIndex, sampleCards.length - 1)];
  const answered = selectedIndex !== null;

  const options = useMemo(
    () =>
      orderOptions(
        buildReviewOptions(
          { term: currentCard.term, meaning: currentCard.meaning },
          optionCandidates,
        ),
        currentCard.term,
      ),
    [currentCard],
  );
  const selectedOption = selectedIndex === null ? null : options[selectedIndex];
  const isCorrect = selectedOption?.isCorrect ?? false;
  const rating = answered
    ? rateReviewAnswer({ correct: isCorrect, attempts: 1 })
    : null;
  const example = searchExamCorpus(currentCard.term).examples[0];

  const modeLabel = MODE_LABELS[mode] ?? MODE_LABELS.today;
  const modeBadge = MODE_BADGES[mode] ?? "new";
  const publicEntry = publicVocab.find(
    (entry) => entry.normalizedTerm === normalizeTerm(currentCard.term),
  );

  // 音标：异步从公共词典补充，失败时静默隐藏
  useEffect(() => {
    let cancelled = false;
    setPhonetic(null);
    const provider = createDictionaryProvider();
    void lookupWithCache(currentCard.term, provider)
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
  }, [currentCard.id, currentCard.term]);

  // FSRS 信息：有真实学习记录才展示
  useEffect(() => {
    let cancelled = false;
    setFsrsInfo(null);
    const repository = createLocalRepository();
    void repository
      .getUserWord("local", normalizeTerm(currentCard.term))
      .then((word) => {
        if (cancelled) {
          return;
        }
        if (word?.fsrs) {
          setFsrsInfo({
            stability: Math.round(word.fsrs.stability),
            difficulty: Math.round(word.fsrs.difficulty * 10) / 10,
            reps: word.fsrs.reps,
          });
        }
      })
      .catch(() => {
        // 本地读取失败时不展示 FSRS 信息
      })
      .finally(() => {
        void repository.close();
      });
    return () => {
      cancelled = true;
    };
  }, [currentCard.id, currentCard.term]);

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

  const persistSession = useCallback(async () => {
    try {
      const repository = createLocalRepository();
      await repository.upsertStudySession({
        id: "local-review-session",
        userId: "local",
        mode: "due",
        wordIds: sampleCards.map((card) => card.id),
        currentIndex,
        startedAt: Date.now() - elapsed * 1000,
        completedAt: null,
      });
      await repository.close();
    } catch {
      // Local persistence should not block review navigation.
    }
  }, [currentIndex, elapsed]);

  const handleExit = useCallback(() => {
    void persistSession();
    navigate("/");
  }, [navigate, persistSession]);

  const handleFinish = useCallback(() => {
    void persistSession();
    setCompleted(true);
  }, [persistSession]);

  const handleAdvance = useCallback(() => {
    if (!answered) {
      return;
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex >= sampleCards.length) {
      handleFinish();
      return;
    }

    setCurrentIndex(nextIndex);
    setSelectedIndex(null);
    setExampleOpen(false);
  }, [answered, currentIndex, handleFinish]);

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
    },
    [answered, options],
  );

  useReviewKeyboard({
    answered,
    options,
    onSelect: handleSelect,
    onAdvance: handleAdvance,
    onExit: handleExit,
  });

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

          <p className="complete-note">这些单词将在明天进入复习</p>

          <button type="button" className="btn-continue" onClick={handleExit}>
            返回首页
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </section>
    );
  }

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
          {currentIndex + 1} / {sampleCards.length}
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
            width: `${((currentIndex + (answered ? 1 : 0)) / sampleCards.length) * 100}%`,
          }}
        />
      </div>

      <div className="word-card" key={currentCard.id}>
        <span className={`word-status-badge ${modeBadge}`}>
          {mode === "today" ? "新词" : mode === "due" ? "复习中" : "学习中"}
        </span>

        <h1 className="word-main" id="review-title">
          {currentCard.term}
        </h1>

        {phonetic ? <div className="word-phonetic">{phonetic}</div> : null}

        <div className="word-speak-row">
          <button
            type="button"
            className={`speak-btn ${speaking ? "speaking" : ""}`}
            aria-label={`朗读 ${currentCard.term}`}
            onClick={() => speakWord(currentCard.term, setSpeaking)}
          >
            <Volume2 size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="word-meaning">{currentCard.meaning}</div>
        {publicEntry?.partOfSpeech ? (
          <div className="word-type">{publicEntry.partOfSpeech}</div>
        ) : null}
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
          「{currentCard.term}」的中文释义是什么？
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
        isCorrect ? (
          <div className="result-banner correct" role="status">
            <CheckCircle2 size={20} aria-hidden="true" />
            <p>
              回答正确 · 正确答案：<strong>{currentCard.meaning}</strong>
            </p>
          </div>
        ) : (
          <div className="result-banner wrong" role="status">
            <XCircle size={20} aria-hidden="true" />
            <p>
              回答错误 · 正确答案：<strong>{currentCard.meaning}</strong>
            </p>
          </div>
        )
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

      {answered ? (
        <div className="rating-row" aria-label="FSRS 评分">
          {RATINGS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`rating-btn ${item.className}`}
              onClick={handleAdvance}
            >
              <strong>{item.label}</strong>
              <span>{item.interval}</span>
            </button>
          ))}
        </div>
      ) : null}

      {answered ? (
        <button type="button" className="btn-continue" onClick={handleAdvance}>
          下一题
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      ) : null}
    </section>
  );
}
