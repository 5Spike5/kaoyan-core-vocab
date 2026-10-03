import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { createUserWordFromLookup } from "../../../src/features/vocab/vocabService";
import { createLocalRepository } from "../../../src/repositories/localRepository";
import VocabListPage from "../../../src/features/vocab/VocabListPage";

// 词典 provider 在测试环境不会真的发请求（JSONP 被禁用），给一个可控实现：
// zzz- 开头的词查不到，其余词返回中文释义。
vi.mock("../../../src/features/lookup/dictionaryProvider", () => {
  class DictionaryNotFoundError extends Error {
    constructor(term: string) {
      super(`词典中未找到「${term}」`);
      this.name = "DictionaryNotFoundError";
    }
  }

  return {
    DictionaryNotFoundError,
    createDictionaryProvider: () => ({
      async lookup(term: string) {
        if (term.startsWith("zzz")) {
          throw new DictionaryNotFoundError(term);
        }
        return {
          term,
          partsOfSpeech: [{ label: "n.", meanings: ["拍手", "鼓掌"] }],
          source: "test",
        };
      },
    }),
  };
});

async function readWord(term: string) {
  const repository = createLocalRepository();
  const word = await repository.getUserWord("local", term);
  await repository.close();
  return word;
}

describe("VocabListPage", () => {
  it("renders status filters, a search input, and an export button", () => {
    render(
      <MemoryRouter>
        <VocabListPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("searchbox", { name: /搜索/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /导出 Excel/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /导入/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /全部/ })).toBeInTheDocument();
  });

  it("lists merged public words with pagination", async () => {
    render(
      <MemoryRouter>
        <VocabListPage />
      </MemoryRouter>,
    );

    // 默认只显示前 10 个词
    expect(await screen.findByText(/显示 10 \//)).toBeInTheDocument();
    expect(screen.getByText("bull run")).toBeInTheDocument();
    // 第 21 个词不在首屏
    expect(screen.queryByText("address")).not.toBeInTheDocument();
    // 有更多时显示加载提示
    expect(screen.getByText(/继续下滑加载更多/)).toBeInTheDocument();
  });

  it("filters the list by a search term", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <VocabListPage />
      </MemoryRouter>,
    );

    await screen.findByText(/显示 10 \//);
    await user.type(
      screen.getByRole("searchbox", { name: /搜索/ }),
      "account for",
    );

    expect(screen.getAllByText("account for").length).toBeGreaterThan(0);
    expect(screen.queryByText("bull run")).not.toBeInTheDocument();
  });

  it("fills every missing meaning in one batch and keeps the ones the dictionary misses", async () => {
    const repository = createLocalRepository();
    await repository.upsertUserWord(
      createUserWordFromLookup({ term: "clap", meaning: "" }),
    );
    await repository.upsertUserWord(
      createUserWordFromLookup({ term: "zzz-unknown", meaning: "" }),
    );
    await repository.close();

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <VocabListPage />
      </MemoryRouter>,
    );

    const fillButton = await screen.findByRole("button", {
      name: /补全释义 \(2\)/,
    });
    await user.click(fillButton);

    await waitFor(async () => {
      const word = await readWord("clap");
      expect(word?.meanings.map((item) => item.text).join("；")).toContain("拍手");
    });

    // 词典查不到的词保持空释义，等下次再补
    const unknown = await readWord("zzz-unknown");
    expect(unknown?.meanings).toEqual([]);
    // 待补数量从 2 降到 1
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /补全释义 \(1\)/ }),
      ).toBeInTheDocument();
    });
  });
});
