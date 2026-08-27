import "fake-indexeddb/auto";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import ReviewPage from "../../../src/features/review/ReviewPage";
import { createLocalRepository } from "../../../src/repositories/localRepository";

const optionButtons = () =>
  screen
    .getAllByRole("button")
    .filter((button) => button.className.includes("answer-option"));

describe("new-word answer logging", () => {
  it("writes a log for every answer so today's progress survives refresh", async () => {
    localStorage.setItem("kaoyan-daily-goal", "60");
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/review?mode=today"]}>
        <ReviewPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/0 \/ 60 词/)).toBeInTheDocument();

    // 答 2 遍（未学完任何词）也应立即写入 2 条新词日志
    await user.click(optionButtons()[0]);
    await user.click(screen.getByRole("button", { name: "下一题" }));
    await user.click(optionButtons()[0]);

    // 等待异步写入完成
    await new Promise((resolve) => setTimeout(resolve, 100));

    const repository = createLocalRepository();
    const logs = await repository.listReviewLogs("local");
    expect(logs).toHaveLength(2);
    expect(logs.every((log) => log.mode === "new")).toBe(true);
    await repository.close();
  });
});
