import { describe, expect, it } from "vitest";
import {
  calculateStreakDays,
  countNewWordsToday,
  recentActivity,
} from "../../../src/features/stats/statsSelectors";
import type { ReviewLog } from "../../../src/types/domain";

// 2026-08-22 15:00 本地时间
const now = new Date(2026, 7, 22, 15, 0, 0).getTime();
const oneDay = 24 * 60 * 60 * 1000;

function makeLog(overrides: Partial<ReviewLog>): ReviewLog {
  return {
    id: "log-1",
    userId: "local",
    wordId: "word-1",
    normalizedTerm: "address",
    rating: 3,
    answeredCorrectly: true,
    elapsedMs: 3000,
    reviewedAt: now,
    ...overrides,
  };
}

describe("countNewWordsToday", () => {
  it("counts today's new-word logs but not review logs", () => {
    const logs = [
      makeLog({ reviewedAt: now, mode: "new", normalizedTerm: "address" }),
      makeLog({ reviewedAt: now, mode: "review", normalizedTerm: "fetch" }),
      makeLog({ reviewedAt: now - 1, mode: "new", normalizedTerm: "bid" }), // 今天 0 点后
      makeLog({
        reviewedAt: now - oneDay,
        mode: "new",
        normalizedTerm: "peak",
      }), // 昨天
    ];
    expect(countNewWordsToday(logs, now)).toBe(2);
  });

  it("keeps legacy logs without a mode marker so the daily goal survives refresh", () => {
    const logs = [
      makeLog({ reviewedAt: now, normalizedTerm: "address" }), // 旧数据：无 mode
      makeLog({ reviewedAt: now, mode: "review", normalizedTerm: "fetch" }),
      makeLog({ reviewedAt: now - oneDay, normalizedTerm: "peak" }), // 昨天的旧日志
    ];
    expect(countNewWordsToday(logs, now)).toBe(1);
  });

  it("counts each new word once even with multiple answer logs", () => {
    const logs = [
      makeLog({ reviewedAt: now, mode: "new", normalizedTerm: "address" }),
      makeLog({ reviewedAt: now, mode: "new", normalizedTerm: "address" }),
      makeLog({ reviewedAt: now, mode: "new", normalizedTerm: "fetch" }),
    ];
    expect(countNewWordsToday(logs, now)).toBe(2);
  });
});

describe("calculateStreakDays", () => {
  it("counts consecutive days ending today", () => {
    const logs = [
      makeLog({ reviewedAt: now }),
      makeLog({ reviewedAt: now - oneDay }),
      makeLog({ reviewedAt: now - 3 * oneDay }), // 断了一天
    ];
    expect(calculateStreakDays(logs, now)).toBe(2);
  });

  it("keeps a yesterday-only streak alive until midnight", () => {
    expect(
      calculateStreakDays([makeLog({ reviewedAt: now - oneDay })], now),
    ).toBe(1);
  });

  it("returns zero when there are no logs", () => {
    expect(calculateStreakDays([], now)).toBe(0);
  });
});

describe("recentActivity", () => {
  it("buckets logs by local calendar day", () => {
    const ts = new Date(2026, 7, 20, 10, 0, 0).getTime();
    const activity = recentActivity([makeLog({ reviewedAt: ts })], 7, now);

    expect(activity).toHaveLength(7);
    // 最后一天是今天（本地 2026-8-22）
    expect(activity[activity.length - 1]?.date).toBe("2026-8-22");
    expect(activity.find((entry) => entry.date === "2026-8-20")?.count).toBe(1);
  });
});
