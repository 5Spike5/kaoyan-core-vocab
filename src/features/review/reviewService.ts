import { normalizeTerm } from "../../lib/normalizeTerm";
import {
  applyRating,
  createNewCard,
  nextWordStatus,
  type ReviewRating,
} from "../../lib/fsrs";
import type { ReviewLog, UserWord } from "../../types/domain";
import type { ReviewAnswerInput, ReviewOption } from "./reviewTypes";

type ReviewCandidate = {
  term: string;
  meaning: string;
};

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

export function createId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
}

export const RATING_TO_NUMBER: Record<ReviewRating, 1 | 2 | 3 | 4> = {
  again: 1,
  hard: 2,
  good: 3,
  easy: 4,
};

/** 应用一次 FSRS 评分并返回更新后的单词（状态、下次复习时间同步变化）。 */
export function applyWordReview(
  word: UserWord,
  rating: ReviewRating,
  now = new Date(),
): UserWord {
  const card = applyRating(word.fsrs ?? createNewCard(now), rating, now);
  return {
    ...word,
    fsrs: card,
    status: nextWordStatus(card),
    nextReviewAt: new Date(card.due).getTime(),
    updatedAt: now.getTime(),
  };
}

/** 构造一条复习日志（rating 为 1-4 的数字表示）。 */
export function createReviewLog(input: {
  word: UserWord;
  rating: ReviewRating;
  answeredCorrectly: boolean;
  elapsedMs: number;
  reviewedAt?: number;
  mode?: "new" | "review";
}): ReviewLog {
  return {
    id: createId("log"),
    userId: input.word.userId,
    wordId: input.word.id,
    normalizedTerm: input.word.normalizedTerm,
    rating: RATING_TO_NUMBER[input.rating],
    answeredCorrectly: input.answeredCorrectly,
    reviewedAt: input.reviewedAt ?? Date.now(),
    elapsedMs: input.elapsedMs,
    mode: input.mode,
  };
}

export function buildReviewOptions(
  current: ReviewCandidate,
  candidates: ReviewCandidate[],
): ReviewOption[] {
  const currentKey = normalizeTerm(current.term);
  const options = new Map<string, ReviewOption>();

  options.set(current.meaning, {
    meaning: current.meaning,
    sourceTerm: current.term,
    isCorrect: true,
  });

  // 干扰项随机抽取：每次从候选词里随机选其他词的释义，避免固定用词表前几个词
  for (const candidate of shuffle(candidates)) {
    if (options.size >= 4) {
      break;
    }

    if (
      normalizeTerm(candidate.term) === currentKey ||
      candidate.meaning === current.meaning ||
      !candidate.meaning.trim()
    ) {
      continue;
    }

    options.set(candidate.meaning, {
      meaning: candidate.meaning,
      sourceTerm: candidate.term,
      isCorrect: false,
    });
  }

  if (options.size < 4) {
    throw new Error("At least four distinct review options are required");
  }

  return Array.from(options.values()).slice(0, 4);
}

export function rateReviewAnswer(input: ReviewAnswerInput): ReviewRating {
  if (!input.correct) {
    return "again";
  }

  if (input.attempts > 1) {
    return "hard";
  }

  return "good";
}
