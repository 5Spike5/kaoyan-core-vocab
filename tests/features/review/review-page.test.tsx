import "fake-indexeddb/auto";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import ReviewPage from "../../../src/features/review/ReviewPage";

describe("ReviewPage", () => {
  it("shows four answer options and reveals the result after selection", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ReviewPage />
      </MemoryRouter>,
    );

    // 返回 + 发音 + 查看例句 + 4 个选项
    expect(screen.getAllByRole("button")).toHaveLength(7);
    expect(screen.getByText("address")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /处理，应对/ }));

    expect(screen.getByText(/正确答案/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "查看例句" }));
    expect(screen.getByText(/真题例句/)).toBeInTheDocument();
  });
});
