import "fake-indexeddb/auto";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { publicVocab } from "../../../src/data/publicVocab";
import ReviewPage from "../../../src/features/review/ReviewPage";
import { createLocalRepository } from "../../../src/repositories/localRepository";
import type { ReviewLog } from "../../../src/types/domain";

function seedLog(index: number, reviewedAt: number): ReviewLog {
  return {
    id: `log-seed-${index}`,
    userId: "local",
    wordId: `word-seed-${index}`,
    normalizedTerm: `seedterm${index}`,
    rating: 3,
    answeredCorrectly: true,
    reviewedAt,
    elapsedMs: 1000,
    mode: "new",
  };
}

describe("daily new-word budget", () => {
  it("only deals the remaining goal when some words were already learned today", async () => {
    localStorage.setItem("kaoyan-daily-goal", "60");
    const repository = createLocalRepository();
    for (let index = 0; index < 50; index += 1) {
      await repository.appendReviewLog(seedLog(index, Date.now()));
    }
    await repository.close();

    render(
      <MemoryRouter initialEntries={["/review?mode=today"]}>
        <ReviewPage />
      </MemoryRouter>,
    );

    // 已学 50 词后只剩 10 个新词额度（种子词不在词库里，不会回炉）
    expect(await screen.findByText(/0 \/ 10 词/)).toBeInTheDocument();
  });

  it("shows the goal-reached empty state once the daily goal is met", async () => {
    localStorage.setItem("kaoyan-daily-goal", "60");
    const repository = createLocalRepository();
    for (let index = 50; index < 60; index += 1) {
      await repository.appendReviewLog(seedLog(index, Date.now()));
    }
    await repository.close();

    render(
      <MemoryRouter initialEntries={["/review?mode=today"]}>
        <ReviewPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("今日目标已完成，明天再来学习新词。"),
    ).toBeInTheDocument();
  });
});

describe("daily new-word cap with legacy over-dealt logs", () => {
  it("caps the deck at the goal even when today's logs exceed it", async () => {
    // 旧版本一天多次进入会留下超额日志：模拟今天已答过 120 个词（均未学完）
    localStorage.setItem("kaoyan-daily-goal", "80");
    const repository = createLocalRepository();
    const now = Date.now();
    const terms = publicVocab.slice(0, 120).map((entry) => entry.normalizedTerm);
    for (const [index, term] of terms.entries()) {
      await repository.appendReviewLog({
        id: `log-over-${index}`,
        userId: "local",
        wordId: `word-${term}`,
        normalizedTerm: term,
        rating: 3,
        answeredCorrectly: true,
        reviewedAt: now,
        elapsedMs: 1000,
        mode: "new",
      });
    }
    await repository.close();

    render(
      <MemoryRouter initialEntries={["/review?mode=today"]}>
        <ReviewPage />
      </MemoryRouter>,
    );

    // 回炉词也被每日目标封顶：最多 80 词，而不是 120
    expect(await screen.findByText(/0 \/ 80 词/)).toBeInTheDocument();
    expect(screen.queryByText(/0 \/ 120 词/)).not.toBeInTheDocument();
  });
});
