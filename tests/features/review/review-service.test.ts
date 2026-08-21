import { describe, expect, it } from "vitest";
import type { UserWord } from "../../../src/types/domain";
import {
  applyWordReview,
  buildReviewOptions,
  createReviewLog,
  rateReviewAnswer,
} from "../../../src/features/review/reviewService";

describe("review service", () => {
  it("creates four options with one correct answer", () => {
    const card = { term: "address", meaning: "处理，应对" };
    const options = buildReviewOptions(card, [
      { term: "address", meaning: "处理，应对" },
      { term: "fetch", meaning: "售得" },
      { term: "bid", meaning: "出价" },
      { term: "peak", meaning: "顶峰" },
    ]);

    expect(options).toHaveLength(4);
    expect(options.filter((option) => option.isCorrect)).toHaveLength(1);
    expect(new Set(options.map((option) => option.meaning)).size).toBe(4);
  });

  it("maps answer quality to an FSRS rating", () => {
    expect(rateReviewAnswer({ correct: true, attempts: 1 })).toBe("good");
    expect(rateReviewAnswer({ correct: true, attempts: 2 })).toBe("hard");
    expect(rateReviewAnswer({ correct: false, attempts: 1 })).toBe("again");
  });

  it("applies a rating to a word and schedules its next review", () => {
    const now = new Date("2026-08-21T00:00:00.000Z");
    const word: UserWord = {
      id: "word-1",
      userId: "local",
      term: "address",
      normalizedTerm: "address",
      meanings: [{ text: "处理，应对", source: "curated" }],
      status: "new",
      tags: [],
      nextReviewAt: null,
      createdAt: 1,
      updatedAt: 1,
    };

    const updated = applyWordReview(word, "good", now);

    expect(updated.fsrs).toBeDefined();
    expect(updated.status).toBe("learning");
    expect(updated.nextReviewAt).not.toBeNull();
    expect(updated.nextReviewAt!).toBeGreaterThan(now.getTime());
    expect(updated.updatedAt).toBe(now.getTime());
  });

  it("builds review logs with numeric ratings", () => {
    const word: UserWord = {
      id: "word-1",
      userId: "local",
      term: "address",
      normalizedTerm: "address",
      meanings: [{ text: "处理，应对", source: "curated" }],
      status: "learning",
      tags: [],
      nextReviewAt: 100,
      createdAt: 1,
      updatedAt: 1,
    };

    const log = createReviewLog({
      word,
      rating: "good",
      answeredCorrectly: true,
      elapsedMs: 5000,
      reviewedAt: 200,
    });

    expect(log.id).toMatch(/^log-/);
    expect(log.rating).toBe(3);
    expect(log.answeredCorrectly).toBe(true);
    expect(log.elapsedMs).toBe(5000);
    expect(log.normalizedTerm).toBe("address");
  });
});
