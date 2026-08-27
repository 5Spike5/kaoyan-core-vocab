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

  it("teaches new words without rating, with interleaved rounds and mixed directions", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/review?mode=today"]}>
        <ReviewPage />
      </MemoryRouter>,
    );

    // 每日目标 80 词；顶部进度按“词”统计（每词 3 遍随机穿插，不连续）
    expect(await screen.findByText(/0 \/ 80 词/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    // 新词模式没有评分按钮
    expect(
      screen.queryByRole("button", { name: /Again/ }),
    ).not.toBeInTheDocument();

    // 方向随机（英→中 / 中→英），逐题作答并统计两种方向都出现过
    let sawChineseOptions = false;
    let sawEnglishOptions = false;
    for (let round = 0; round < 240; round += 1) {
      const buttons = optionButtons();
      const text = buttons.map((button) => button.textContent ?? "").join(" ");
      if (/[\u4e00-\u9fff]/.test(text)) {
        sawChineseOptions = true;
      }
      if (/[a-zA-Z]/.test(text)) {
        sawEnglishOptions = true;
      }

      await user.click(buttons[0]);
      expect(screen.getByText(/正确答案/)).toBeInTheDocument();

      if (round === 239 || (sawChineseOptions && sawEnglishOptions)) {
        break;
      }
      await user.click(screen.getByRole("button", { name: "下一题" }));
    }
    expect(sawChineseOptions).toBe(true);
    expect(sawEnglishOptions).toBe(true);
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
