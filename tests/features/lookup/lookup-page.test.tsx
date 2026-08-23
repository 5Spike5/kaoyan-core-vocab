import "fake-indexeddb/auto";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { createUserWordFromLookup } from "../../../src/features/vocab/vocabService";
import { createLocalRepository } from "../../../src/repositories/localRepository";
import LookupPage from "../../../src/features/lookup/LookupPage";

describe("LookupPage", () => {
  it("shows an existing vocab word without an add button", async () => {
    const repository = createLocalRepository();
    await repository.upsertUserWord(
      createUserWordFromLookup({ term: "fetch", meaning: "售得" }),
    );
    await repository.close();

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LookupPage />
      </MemoryRouter>,
    );

    await user.type(
      screen.getByRole("searchbox", { name: "输入单词或短语" }),
      "fetch",
    );
    await user.click(screen.getByRole("button", { name: "搜索" }));

    expect(await screen.findByText(/已在生词库/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /加入生词库/ }),
    ).not.toBeInTheDocument();
  });
});
