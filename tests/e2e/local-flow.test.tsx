import "fake-indexeddb/auto";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import App from "../../src/app/App";
import { createLocalRepository } from "../../src/repositories/localRepository";

describe("local learning flow", () => {
  beforeAll(() => {
    // 屏蔽真实网络请求：词典查询在本测试中一律视为未找到，
    // 验证本地语料结果不依赖网络。
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }),
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("walks through dashboard, review, lookup, and add-to-vocab", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    // 1. Dashboard renders.
    const nav = screen.getByRole("navigation", { name: "主导航" });
    expect(
      within(nav).getByRole("link", { name: "今日学习" }),
    ).toBeInTheDocument();

    // 2. Start review.
    await user.click(screen.getByRole("button", { name: "开始今日学习" }));

    // 3. New-word learning view: a word card with four answer options.
    expect(
      await screen.findByRole("heading", { level: 1 }),
    ).toBeInTheDocument();
    const optionButtons = () =>
      screen
        .getAllByRole("button")
        .filter((button) => button.className.includes("answer-option"));
    expect(optionButtons()).toHaveLength(4);

    // 4. Select the first option; feedback appears.
    await user.click(optionButtons()[0]);
    expect(await screen.findByText(/正确答案/)).toBeInTheDocument();

    // 5. Reveal the exam example.
    await user.click(screen.getByRole("button", { name: "查看例句" }));
    expect(screen.getByText(/真题例句/)).toBeInTheDocument();

    // 6. Escape returns to the dashboard.
    await user.keyboard("{Escape}");
    const dashboardNav = screen.getByRole("navigation", { name: "主导航" });
    expect(
      await within(dashboardNav).findByRole("link", { name: "今日学习" }),
    ).toBeInTheDocument();

    // 7. Open lookup.
    const topNav = screen.getByRole("navigation", { name: "主导航" });
    await user.click(within(topNav).getByRole("link", { name: "查词" }));
    expect(
      await screen.findByRole("heading", { name: "查词" }),
    ).toBeInTheDocument();

    // 8. Query `address`; local corpus results appear without network.
    const input = screen.getByRole("searchbox", { name: "输入单词或短语" });
    await user.type(input, "address");
    await user.click(screen.getByRole("button", { name: "搜索" }));
    expect(await screen.findByText(/总出现次数/)).toBeInTheDocument();

    // 9. Add it to the local word repository.
    await user.click(screen.getByRole("button", { name: /加入生词库/ }));
    expect(await screen.findByText(/已加入生词库/)).toBeInTheDocument();

    // 10. The repository now contains the word.
    const repository = createLocalRepository();
    const saved = await repository.getUserWord("local", "address");
    expect(saved).not.toBeNull();
    expect(saved?.normalizedTerm).toBe("address");
    await repository.close();
  });
});
