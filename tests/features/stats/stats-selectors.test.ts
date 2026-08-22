import { describe, expect, it } from "vitest";
import { countNewWordsToday } from "../../../src/features/stats/statsSelectors";
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
      makeLog({ reviewedAt: now, mode: "new" }),
      makeLog({ reviewedAt: now, mode: "review" }),
      makeLog({ reviewedAt: now - 1, mode: "new" }), // 今天 0 点后
      makeLog({ reviewedAt: now - oneDay, mode: "new" }), // 昨天
    ];
    expect(countNewWordsToday(logs, now)).toBe(2);
  });

  it("keeps legacy logs without a mode marker so the daily goal survives refresh", () => {
    const logs = [
      makeLog({ reviewedAt: now }), // 旧数据：无 mode
      makeLog({ reviewedAt: now, mode: "review" }),
      makeLog({ reviewedAt: now - oneDay }), // 昨天的旧日志
    ];
    expect(countNewWordsToday(logs, now)).toBe(1);
  });
});
