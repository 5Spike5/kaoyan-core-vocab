import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { createUserWordFromLookup } from "../../../src/features/vocab/vocabService";
import { createLocalRepository } from "../../../src/repositories/localRepository";
import LookupPage from "../../../src/features/lookup/LookupPage";

// 词典 provider 在测试环境不会真的发请求（JSONP 被禁用），这里给出可控的
// “有道”字典结果：普通词返回中文释义，zzz- 开头的词返回空释义。
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
          return { term, partsOfSpeech: [], source: "test" };
        }
        return {
          term,
          phonetic: "rəʊm",
          partsOfSpeech: [
            { label: "n.", meanings: ["漫步", "漫游"] },
            { label: "v.", meanings: ["闲逛"] },
          ],
          source: "test",
        };
      },
    }),
  };
});

async function search(user: ReturnType<typeof userEvent.setup>, term: string) {
  await user.type(
    screen.getByRole("searchbox", { name: "输入单词或短语" }),
    term,
  );
  await user.click(screen.getByRole("button", { name: "搜索" }));
}

const addButtonPattern = /加入生词库|正在获取释义|补充释义/;

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

    await search(user, "fetch");

    expect(await screen.findByText(/已在生词库/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: addButtonPattern }),
    ).not.toBeInTheDocument();
  });

  it("stores the dictionary meaning for a word missing from the core vocab", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LookupPage />
      </MemoryRouter>,
    );

    await search(user, "roam");

    // 核心词库里没有 roam，释义要等公共词典返回后才可入库
    const addButton = await screen.findByRole("button", {
      name: addButtonPattern,
    });
    await waitFor(() => expect(addButton).toBeEnabled());
    expect(addButton).toHaveTextContent("加入生词库");

    await user.click(addButton);

    const repository = createLocalRepository();
    const word = await repository.getUserWord("local", "roam");
    await repository.close();

    expect(word).not.toBeNull();
    expect(word!.meanings.map((item) => item.text).join("；")).toContain("漫步");
    expect(word!.status).toBe("new");
  });

  it("offers to refill a meaning for a word stored without one", async () => {
    const repository = createLocalRepository();
    await repository.upsertUserWord(
      createUserWordFromLookup({ term: "cricket", meaning: "" }),
    );
    await repository.close();

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LookupPage />
      </MemoryRouter>,
    );

    await search(user, "cricket");

    expect(
      await screen.findByText(/还没有释义，补充释义后即可进入背诵/),
    ).toBeInTheDocument();

    const refill = await screen.findByRole("button", { name: "补充释义" });
    await waitFor(() => expect(refill).toBeEnabled());
    await user.click(refill);

    const repo2 = createLocalRepository();
    const word = await repo2.getUserWord("local", "cricket");
    await repo2.close();

    expect(word!.meanings.map((item) => item.text).join("；")).toContain("漫步");
  });

  it("refuses to store a word when no meaning can be found", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LookupPage />
      </MemoryRouter>,
    );

    await search(user, "zzz-no-such-word");

    const addButton = await screen.findByRole("button", {
      name: addButtonPattern,
    });
    await waitFor(() => expect(addButton).toBeEnabled());
    await user.click(addButton);

    const repository = createLocalRepository();
    const word = await repository.getUserWord("local", "zzz-no-such-word");
    await repository.close();

    // 空释义的词进不了学习队列，宁可不入库也不留脏数据
    expect(word).toBeNull();
  });
});
