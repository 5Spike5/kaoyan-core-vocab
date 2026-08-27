import "fake-indexeddb/auto";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
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
