import "fake-indexeddb/auto";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, it } from "vitest";
import { createUserWordFromLookup } from "../../../src/features/vocab/vocabService";
import { createLocalRepository } from "../../../src/repositories/localRepository";
import ReviewPage from "../../../src/features/review/ReviewPage";

beforeAll(async () => {
  // 新词模式取核心词表前 80 个新词；把第一个词 bull run 的释义替换为
  // 自定义文本，保证测试确定性（其余新词来自公共词库）。
  const repository = createLocalRepository();
  await repository.upsertUserWord(
    createUserWordFromLookup({ term: "bull run", meaning: "测试释义" }),
  );
  await repository.close();
});

describe("ReviewPage", () => {
  it("shows the empty state when nothing is due", async () => {
    render(
      <MemoryRouter initialEntries={["/review?mode=due"]}>
        <ReviewPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("没有可学习的内容")).toBeInTheDocument();
  });

  it("teaches new words without rating and alternates question direction", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/review?mode=today"]}>
        <ReviewPage />
      </MemoryRouter>,
    );

    // 每日目标 80 词 × 3 遍 = 240 题
    expect(await screen.findByText(/1 \/ 240/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "bull run" }),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("button")
        .filter((button) => button.className.includes("answer-option")),
    ).toHaveLength(4);
    // 新词模式不需要 FSRS 评分
    expect(
      screen.queryByRole("button", { name: /Again/ }),
    ).not.toBeInTheDocument();

    // 第 1 遍：英文问中文
    await user.click(screen.getByRole("button", { name: /测试释义/ }));
    expect(screen.getByText(/正确答案/)).toBeInTheDocument();

    // 下一题 → 第 2 遍：中文问英文
    await user.click(screen.getByRole("button", { name: "下一题" }));
    expect(
      await screen.findByText(/「测试释义」对应的英文单词是？/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "测试释义" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /bull run/ }));
    // 中问英答对后，横幅显示“回答正确”，正确答案为 bull run
    expect(await screen.findByText(/回答正确/)).toBeInTheDocument();
    expect(screen.getAllByText("bull run").length).toBeGreaterThan(0);
  });

  it("reviews due words in English-to-Chinese with FSRS rating", async () => {
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

    // 复习只给英文问中文
    expect(
      await screen.findByText(/「crucial」的中文释义是什么？/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/对应的英文单词是/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /至关重要的/ }));

    expect(screen.getByText(/正确答案/)).toBeInTheDocument();
    // 复习模式保留 FSRS 评分
    expect(screen.getByRole("button", { name: /Again/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Easy/ })).toBeInTheDocument();

    // 例句可展开
    await user.click(screen.getByRole("button", { name: "查看例句" }));
    expect(screen.getByText(/真题例句/)).toBeInTheDocument();
  });
});
