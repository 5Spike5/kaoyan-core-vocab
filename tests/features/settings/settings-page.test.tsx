import "fake-indexeddb/auto";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import SettingsPage from "../../../src/features/settings/SettingsPage";

// 测试与开发者本地 .env 解耦：始终按“未配置 Supabase”的本地模式渲染。
vi.mock("../../../src/repositories/supabaseClient", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../../src/repositories/supabaseClient")
    >();
  return {
    ...actual,
    isSupabaseConfigured: () => false,
  };
});

describe("SettingsPage", () => {
  it("renders sync, export, mode, and sign-out controls", () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/本地模式/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /立即同步/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /导出个人数据/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /清理本地缓存/ }),
    ).toBeInTheDocument();
  });
});
