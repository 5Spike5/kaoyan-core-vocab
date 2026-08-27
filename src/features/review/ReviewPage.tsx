import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Trash2,
  Volume2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { searchExamCorpus } from "../../data/corpusIndex";
import { publicVocab } from "../../data/publicVocab";
import { normalizeTerm } from "../../lib/normalizeTerm";
import { highlightTerm } from "../../lib/highlightTerm";
import { speakWord, stopSpeech } from "../../lib/tts";
import { runAutoCloudSync } from "../../repositories/cloudSync";
import { createLocalRepository } from "../../repositories/localRepository";
import type { ReviewLog, UserWord } from "../../types/domain";
import { lookupWithCache } from "../lookup/dictionaryApi";
import { createDictionaryProvider } from "../lookup/dictionaryProvider";
import {
  calculateTodayStudyMinutes,
  newWordTermsToday,
} from "../stats/statsSelectors";
import { mergePublicAndUserWords } from "../vocab/vocabService";
import {
  applyWordReview,
  buildReviewOptions,
  createReviewLog,
} from "./reviewService";
import type { ReviewOption, ReviewRating } from "./reviewTypes";

const LOCAL_USER_ID = "local";
const GOAL_KEY = "kaoyan-daily-goal";
const REVIEW_LIMIT_KEY = "kaoyan-review-limit";
const NEW_WORD_ROUNDS = 3;
const NEW_WORD_DIRECTIONS: Array<"e2c" | "c2e"> = ["e2c", "c2e", "e2c"];
/** 复习数量选项：0 表示全部（不限制） */
const REVIEW_LIMIT_OPTIONS = [10, 20, 30, 50, 0];

type Direction = "e2c" | "c2e";

type DeckItem = {
  id: string;
  /** bonus = 新词 3 遍后的巩固题；retry = 复习模式答错后重排的同一词 */
  kind?: "normal" | "bonus" | "retry";
  /** 今日已答过但未学满 3 遍、回炉续学的词 */
  resumed?: boolean;
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

/** 复习数量：0 表示不限制（全部）；上次的选择会被记住。 */
function loadReviewLimit(): number {
  const saved = Number(localStorage.getItem(REVIEW_LIMIT_KEY));
  return REVIEW_LIMIT_OPTIONS.includes(saved) ? saved : 20;
}

function startOfTomorrow(now = Date.now()) {
  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function buildDeck(
  words: UserWord[],
  mode: string,
  reviewLimit: number,
  newWordBudget: number,
  newWordCap: number,
  startedTerms: Set<string>,
): DeckItem[] {
  const meaningOf = (word: UserWord) => word.meanings[0]?.text ?? "";
  const hasMeaning = (word: UserWord) => Boolean(meaningOf(word));

  if (mode === "today") {
    const pool = words.filter((word) => word.status === "new" && hasMeaning(word));
    // 今日已答过但未学满 3 遍的词优先回炉（已计入今日进度，不占新词名额）
    const started = shuffle(
      pool.filter((word) => startedTerms.has(word.normalizedTerm)),
    );
    // 全新词只发“今日剩余额度”，保证每天学的新词正好是目标数量
    const fresh = shuffle(
      pool.filter((word) => !startedTerms.has(word.normalizedTerm)),
    ).slice(0, Math.max(0, newWordBudget));
    // 总量以每日目标硬性封顶：旧版本一天多次进入可能留下超额的半途词，
    // 超出部分今天不再回炉（仍是新词，明天会重新发放）
    const newWords = [...started, ...fresh].slice(0, newWordCap);
    const rounds: DeckItem[] = [];
    for (const word of newWords) {
      const resumed = startedTerms.has(word.normalizedTerm);
      for (let round = 0; round < NEW_WORD_ROUNDS; round += 1) {
        rounds.push({
          id: `${word.normalizedTerm}#r${round}`,
          kind: "normal",
          resumed,
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
    return shuffle(rounds);
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
  const cap = reviewLimit === 0 ? pool.length : reviewLimit;

  return shuffle(pool)
    .slice(0, cap)
    .map((word) => ({
      id: `${word.normalizedTerm}#review`,
      kind: "normal" as const,
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
  const [logs, setLogs] = useState<ReviewLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [exampleOpen, setExampleOpen] = useState(false);
  const [revealOpen, setRevealOpen] = useState(false);
  const [removedWordIds, setRemovedWordIds] = useState<Set<string>>(new Set());
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
  const [reviewLimit, setReviewLimit] = useState(loadReviewLimit);
  // 会话内动态追加的题目：新词巩固题 / 复习错词重排
  const [extraItems, setExtraItems] = useState<DeckItem[]>([]);

  // 新词模式：记录每个词 3 遍的整体对错与作答耗时，用于最后的 FSRS 评级
  const wordResultsRef = useRef(
    new Map<string, { correct: number; total: number; elapsedMs: number }>(),
  );
  const questionStartRef = useRef(Date.now());
  /** 本会话已排过巩固题的新词（每词最多一次） */
  const bonusQueuedRef = useRef(new Set<string>());
  /** 本会话已重排过的复习词（每词最多一次） */
  const requeuedRef = useRef(new Set<string>());
  /** 巩固题的作答结果（答对视为当天记住） */
  const bonusResultRef = useRef(new Map<string, boolean>());

  const goal = loadGoal();
  const isNewWordMode = mode === "today";

  const loadWords = useCallback(async () => {
    const repository = createLocalRepository();
    try {
      const [userWords, reviewLogs] = await Promise.all([
        repository.listUserWords(LOCAL_USER_ID),
        repository.listReviewLogs(LOCAL_USER_ID),
      ]);
      setWords(mergePublicAndUserWords(publicVocab, userWords));
      setLogs(reviewLogs);
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

  // 今日已学新词（按词去重）：用来计算剩余额度，保证一天学的新词不超过目标
  const newWordTerms = useMemo(() => newWordTermsToday(logs), [logs]);
  const baseDeck = useMemo(
    () =>
      buildDeck(
        words,
        mode,
        reviewLimit,
        isNewWordMode ? goal - newWordTerms.size : 0,
        isNewWordMode ? goal : 0,
        newWordTerms,
      ).filter((deckItem) => !removedWordIds.has(deckItem.word.id)),
    [words, mode, goal, reviewLimit, newWordTerms, removedWordIds, isNewWordMode],
  );
  // 最终队列 = 计划题目 + 动态追加（巩固/重排），斩掉的词从两部分都移除
  const deck = useMemo(
    () => [
      ...baseDeck,
      ...extraItems.filter((extra) => !removedWordIds.has(extra.word.id)),
    ],
    [baseDeck, extraItems, removedWordIds],
  );
  const item = deck[currentIndex];
  const answered = selectedIndex !== null;

  // 新词模式按“词”统计进度：一个词 3 遍全部答完才算学完 1 词
  const deckWordCount = useMemo(
    () => new Set(deck.map((deckItem) => deckItem.word.id)).size,
    [deck],
  );
  const learnedWordCount = useMemo(() => {
    const position = currentIndex + (answered ? 1 : 0);
    const lastIndexOf = new Map<string, number>();
    deck.forEach((deckItem, index) => {
      lastIndexOf.set(
        deckItem.word.id,
        Math.max(lastIndexOf.get(deckItem.word.id) ?? -1, index),
      );
    });
    return [...lastIndexOf.values()].filter((index) => index < position).length;
  }, [answered, currentIndex, deck]);

  // 斩掉某词后，如果指针越界则回退到最后一个词
  useEffect(() => {
    if (deck.length === 0 || currentIndex < deck.length) {
      return;
    }
    setCurrentIndex(deck.length - 1);
    setSelectedIndex(null);
    setExampleOpen(false);
    setRevealOpen(false);
  }, [deck.length, currentIndex]);

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
    return buildReviewOptions(current, candidates);
  }, [item, words]);

  const selectedOption = selectedIndex === null ? null : options[selectedIndex];
  const isCorrect = selectedOption?.isCorrect ?? false;
  const example = item
    ? searchExamCorpus(item.word.term).examples[0]
    : undefined;

  const modeLabel = MODE_LABELS[mode] ?? MODE_LABELS.today;
  const modeBadge = MODE_BADGES[mode] ?? "new";
  const partOfSpeech = item
    ? publicVocab.find(
        (entry) => entry.normalizedTerm === normalizeTerm(item.word.term),
      )?.partOfSpeech
    : undefined;
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

  // 每次作答后自动朗读一次当前单词；离开时停掉未播完的语音避免叠加
  useEffect(() => {
    if (!answered || !item) {
      return;
    }
    speakWord(item.word.term, setSpeaking);
    return () => {
      stopSpeech();
      setSpeaking(false);
    };
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
      mode: "new" | "review",
      deferToTomorrow = false,
    ) => {
      const word = words.find((entry) => entry.id === wordId);
      if (!word) {
        return;
      }
      const repository = createLocalRepository();
      try {
        const updated = applyWordReview(word, rating);
        // 新词学完不立即涌入复习队列：good 的到期时间至少推到次日
        if (deferToTomorrow) {
          updated.nextReviewAt =
            updated.nextReviewAt === null
              ? startOfTomorrow()
              : Math.max(updated.nextReviewAt, startOfTomorrow());
        }
        await repository.upsertUserWord(updated);
        await repository.appendReviewLog(
          createReviewLog({
            word: updated,
            rating,
            answeredCorrectly,
            elapsedMs,
            mode,
          }),
        );
      } finally {
        await repository.close();
      }
    },
    [words],
  );

  /** 新词模式：单词学完（含巩固题）后按表现更新词状态（日志已按遍写入，这里不再重复记录）。 */
  const finalizeWord = useCallback(
    async (wordId: string) => {
      const result = wordResultsRef.current.get(wordId);
      if (!result || result.total === 0) {
        return;
      }
      wordResultsRef.current.delete(wordId);
      const bonusCorrect = bonusResultRef.current.get(wordId);
      bonusResultRef.current.delete(wordId);
      const word = words.find((entry) => entry.id === wordId);
      if (!word) {
        return;
      }
      // 有巩固题时以巩固题结果为准（答对说明当天记住了）；否则按 3 遍全对与否
      const rating: ReviewRating =
        bonusCorrect === undefined
          ? result.correct === result.total
            ? "good"
            : "again"
          : bonusCorrect
            ? "good"
            : "again";
      const repository = createLocalRepository();
      try {
        const updated = applyWordReview(word, rating);
        // 新词学完不立即涌入复习队列：到期时间至少推到次日
        updated.nextReviewAt =
          updated.nextReviewAt === null
            ? startOfTomorrow()
            : Math.max(updated.nextReviewAt, startOfTomorrow());
        await repository.upsertUserWord(updated);
      } finally {
        await repository.close();
      }
    },
    [words],
  );

  /** 斩掉某词：标记为已斩，并从当前学习队列中移除。 */
  const handleSuspend = useCallback(() => {
    if (!item) {
      return;
    }
    const wordId = item.word.id;
    const word = words.find((entry) => entry.id === wordId);
    if (word) {
      const repository = createLocalRepository();
      void repository
        .upsertUserWord({
          ...word,
          status: "suspended",
          nextReviewAt: null,
          updatedAt: Date.now(),
        })
        .finally(() => repository.close());
    }
    wordResultsRef.current.delete(wordId);
    setRemovedWordIds((previous) => {
      const next = new Set(previous);
      next.add(wordId);
      return next;
    });
    setSelectedIndex(null);
    setExampleOpen(false);
    setRevealOpen(false);
    questionStartRef.current = Date.now();
  }, [item, words]);

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

  /**
   * 推进到下一题。同一次调用里如果刚追加了新题（巩固题），用
   * queuedBeyondClosure 补上尚未反映进 deck 闭包的长度。
   */
  const advanceCore = useCallback(() => {
    if (!answered) {
      return;
    }

    const nextIndex = currentIndex + 1;
    const current = deck[currentIndex];
    let queuedBeyondClosure = 0;

    // 新词模式：3 遍答完后决定写回还是追加巩固题；巩固题答完才写回
    if (isNewWordMode && current) {
      const entry = wordResultsRef.current.get(current.word.id);
      const bonusQueued = bonusQueuedRef.current.has(current.word.id);
      if (entry && entry.total >= NEW_WORD_ROUNDS) {
        if (current.kind === "bonus") {
          // 巩固题答完才写回
          void finalizeWord(current.word.id);
        } else if (!bonusQueued && entry.correct < NEW_WORD_ROUNDS) {
          // 有错：排一道方向相反的巩固题，答对则按记住写回
          bonusQueuedRef.current.add(current.word.id);
          setExtraItems((previous) => [
            ...previous,
            {
              ...current,
              id: `${current.id}#bonus`,
              kind: "bonus" as const,
              resumed: false,
              direction:
                current.direction === "e2c"
                  ? ("c2e" as const)
                  : ("e2c" as const),
            },
          ]);
          queuedBeyondClosure += 1;
        } else {
          void finalizeWord(current.word.id);
        }
      }
    }

    if (nextIndex >= deck.length + queuedBeyondClosure) {
      handleFinish();
      return;
    }

    setCurrentIndex(nextIndex);
    setSelectedIndex(null);
    setExampleOpen(false);
    setRevealOpen(false);
    questionStartRef.current = Date.now();
  }, [answered, currentIndex, deck, finalizeWord, handleFinish, isNewWordMode]);

  const handleAdvance = useCallback(() => {
    advanceCore();
  }, [advanceCore]);

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

      // 答完自动展开真题例句（无论对错）；答错后自动展开所有选项释义方便对照，答对则收起
      if (example) {
        setExampleOpen(true);
      }
      setRevealOpen(options[index]?.isCorrect ? false : true);

      const entry = wordResultsRef.current.get(item!.word.id) ?? {
        correct: 0,
        total: 0,
        elapsedMs: 0,
      };
      entry.total += 1;
      const answerMs = Date.now() - questionStartRef.current;
      entry.elapsedMs += answerMs;
      if (options[index]?.isCorrect) {
        entry.correct += 1;
      }
      wordResultsRef.current.set(item!.word.id, entry);

      // 巩固题的对错单独记录，用于最终评级
      if (item!.kind === "bonus") {
        bonusResultRef.current.set(
          item!.word.id,
          Boolean(options[index]?.isCorrect),
        );
      }

      // 复习模式答错：把该词追加到队列末尾再练一遍（每词每次会话最多一次）
      if (
        !isNewWordMode &&
        !options[index]?.isCorrect &&
        !requeuedRef.current.has(item!.word.id)
      ) {
        requeuedRef.current.add(item!.word.id);
        setExtraItems((previous) => [
          ...previous,
          { ...item!, id: `${item!.id}#retry`, kind: "retry" as const },
        ]);
      }

      // 新词模式：每遍作答即时写一条日志（中途退出/刷新也不丢今日进度），
      // 今日目标按词去重统计；词状态仍在 3 遍完成后由 finalizeWord 更新。
      if (isNewWordMode) {
        const word = words.find((candidate) => candidate.id === item!.word.id);
        if (word) {
          const repository = createLocalRepository();
          void repository
            .appendReviewLog(
              createReviewLog({
                word,
                rating: options[index]?.isCorrect ? "good" : "again",
                answeredCorrectly: Boolean(options[index]?.isCorrect),
                elapsedMs: answerMs,
                mode: "new",
              }),
            )
            .finally(() => repository.close());
        }
      }
    },
    [answered, example, isNewWordMode, item, options, words],
  );

  const handleRate = useCallback(
    (rating: ReviewRating) => {
      if (!answered || !item) {
        return;
      }
      const elapsedMs = Date.now() - questionStartRef.current;
      void writeBackWord(item.word.id, rating, isCorrect, elapsedMs, "review");
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
    const goalReached =
      mode === "today" &&
      goal - newWordTerms.size <= 0 &&
      words.some((word) => word.status === "new");
    const emptyMessage =
      mode === "today"
        ? goalReached
          ? "今日目标已完成，明天再来学习新词。"
          : "今天没有新词了，明天再来巩固。"
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
            {isNewWordMode ? (
              <div className="complete-stat">
                <strong>{deckWordCount}</strong>
                <span>单词</span>
              </div>
            ) : null}
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
              <span>{isNewWordMode ? "答题" : "总数"}</span>
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
              ? "每个单词学习了 3 遍，明天记得回来复习"
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
          {isNewWordMode
            ? `${learnedWordCount} / ${deckWordCount} 词`
            : `${currentIndex + 1} / ${deck.length}`}
        </div>
        <div className="study-timer">
          <Clock size={14} aria-hidden="true" />
          {formatTime(elapsed)}
        </div>
        <span className="pass-badge">{modeLabel}</span>
      </div>

      {!isNewWordMode ? (
        <div
          className="review-limit-row"
          role="group"
          aria-label="本次复习数量"
        >
          <span className="review-limit-label">本次复习</span>
          {REVIEW_LIMIT_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={`review-limit-btn ${reviewLimit === option ? "active" : ""}`}
              aria-pressed={reviewLimit === option}
              onClick={() => {
                setReviewLimit(option);
                localStorage.setItem(REVIEW_LIMIT_KEY, String(option));
                setCurrentIndex(0);
                setSelectedIndex(null);
                setExampleOpen(false);
                setRevealOpen(false);
              }}
            >
              {option === 0 ? "全部" : option}
            </button>
          ))}
        </div>
      ) : null}

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
          {item?.kind === "bonus"
            ? "巩固"
            : item?.kind === "retry"
              ? "再练"
              : isNewWordMode
                ? "新词"
                : mode === "due"
                  ? "复习中"
                  : "学习中"}
        </span>
        {item?.resumed && item.kind === "normal" ? (
          <span className="word-status-badge resumed">续学</span>
        ) : null}

        {isC2E ? (
          <h1 className="word-main" id="review-title">
            {item?.word.meaning}
          </h1>
        ) : (
          <>
            <h1 className="word-main english" id="review-title">
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

        {partOfSpeech ? <div className="word-type">{partOfSpeech}</div> : null}

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
              className={`answer-option ${isC2E ? "english-option" : ""} ${stateClass} ${
                revealOpen ? "revealed" : ""
              }`}
              disabled={answered}
              onClick={() => handleSelect(index)}
            >
              <span>{OPTION_LETTERS[index]}</span>
              <strong>{option.meaning}</strong>
              {revealOpen ? (
                <em className="option-translation">{option.sourceTerm}</em>
              ) : null}
            </button>
          );
        })}
      </div>

      {!answered ? (
        <button
          type="button"
          className={`reveal-btn ${revealOpen ? "revealed" : ""}`}
          onClick={() => setRevealOpen((value) => !value)}
        >
          {revealOpen ? "收起释义" : "查看释义"}
        </button>
      ) : null}

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

      {answered && example ? (
        <div className="example-box" role="note">
          <p className="example-label">真题例句</p>
          <p className="example-en">
            {highlightTerm(example.sentence, item!.word.term)}
          </p>
          {example.translation ? (
            <p className="example-cn">{example.translation}</p>
          ) : null}
        </div>
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

      <div className="ignore-row">
        <button type="button" className="ignore-btn" onClick={handleSuspend}>
          <Trash2 size={14} aria-hidden="true" />
          斩掉该词（不再学习）
        </button>
      </div>
    </section>
  );
}
