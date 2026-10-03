import "fake-indexeddb/auto";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { publicVocab } from "../../../src/data/publicVocab";
import {
  countUniquePublicTerms,
  createUserWordFromLookup,
} from "../../../src/features/vocab/vocabService";
import { createLocalRepository } from "../../../src/repositories/localRepository";
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

  it("keeps meaning-less custom words out of the 待学 count and explains why", async () => {
    const repository = createLocalRepository();
    // 查词写入、但没有释义的自建词：进不了学习队列，就不该算进“待学”
    await repository.upsertUserWord(
      createUserWordFromLookup({ term: "roam", meaning: "" }),
    );
    await repository.close();

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/有 1 个自建词还没有释义/),
    ).toBeInTheDocument();

    const expectedTodo = countUniquePublicTerms(publicVocab).toLocaleString();
    const todoCells = await screen.findAllByText(expectedTodo);
    expect(todoCells.length).toBeGreaterThan(0);
  });
});
