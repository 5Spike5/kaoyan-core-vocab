import "fake-indexeddb/auto";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import DashboardPage from "../../../src/features/dashboard/DashboardPage";

describe("DashboardPage", () => {
  it("prioritizes due reviews and new-word study", () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("button", { name: "开始今日学习" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /今日背诵/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /强制复习/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /自主复习/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "80" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "单词表" })).toBeInTheDocument();
  });
});
