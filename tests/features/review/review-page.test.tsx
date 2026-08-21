import "fake-indexeddb/auto";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { createUserWordFromLookup } from "../../../src/features/vocab/vocabService";
import { createLocalRepository } from "../../../src/repositories/localRepository";
import ReviewPage from "../../../src/features/review/ReviewPage";

const optionButtons = () =>
  screen
    .getAllByRole("button")
    .filter((button) => button.className.includes("answer-option"));

describe("ReviewPage", () => {
  it("shows the empty state when nothing is due", async () => {
    render(
      <MemoryRouter initialEntries={["/review?mode=due"]}>
        <ReviewPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("没有可学习的内容")).toBeInTheDocument();
  });

  it("teaches new words without rating, shuffled, with alternating direction", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/review?mode=today"]}>
        <ReviewPage />
      </MemoryRouter>,
    );

    // 每日目标 80 词 × 3 遍 = 240 题（乱序）
    expect(await screen.findByText(/1 \/ 240/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    // 新词模式没有评分按钮
    expect(
      screen.queryByRole("button", { name: /Again/ }),
    ).not.toBeInTheDocument();

    // 第 1 遍：英文问中文 → 选项是中文释义
    expect(
      optionButtons().every((button) =>
        /[\u4e00-\u9fff]/.test(button.textContent ?? ""),
      ),
    ).toBe(true);

    await user.click(optionButtons()[0]);
    expect(screen.getByText(/正确答案/)).toBeInTheDocument();

    // 下一题 → 第 2 遍：中文问英文 → 选项变成英文单词
    await user.click(screen.getByRole("button", { name: "下一题" }));
    expect(
      optionButtons().every((button) =>
        /[a-zA-Z]/.test(button.textContent ?? ""),
      ),
    ).toBe(true);

    await user.click(optionButtons()[0]);
    expect(await screen.findByText(/回答/)).toBeInTheDocument();
  });

  it("reviews due words in English-to-Chinese with FSRS rating and auto example", async () => {
    const repository = createLocalRepository();
    await repository.upsertUserWord(
      createUserWordFromLookup({ term: "crucial", meaning: "至关重要的" }),
    );
    const word = await repository.getUserWord("local", "crucial");
    await repository.upsertUserWord({
      ...word!,
      status: "reviewing",
      nextReviewAt: Date.now() - 1000,
    });
    await repository.close();

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/review?mode=due"]}>
        <ReviewPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "crucial" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /至关重要的/ }));

    expect(screen.getByText(/正确答案/)).toBeInTheDocument();
    // 复习模式保留 FSRS 评分
    expect(screen.getByRole("button", { name: /Again/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Easy/ })).toBeInTheDocument();
    // 答完自动展开真题例句
    expect(screen.getByText(/真题例句/)).toBeInTheDocument();
  });
});
