import { describe, expect, it, vi } from "vitest";
import {
  createDictionaryProvider,
  DictionaryNotFoundError,
  DictionaryServiceError,
  isSameTerm,
  parseYoudaoSuggest,
} from "../../../src/features/lookup/dictionaryProvider";

describe("youdao suggest parser", () => {
  it("parses explain into part-of-speech groups with audio", () => {
    const result = parseYoudaoSuggest({
      data: {
        entries: [
          {
            entry: "address",
            explain:
              "n. 地址，住址；网址；演讲，演说；<古>（对他人的）谈吐；v. 解决，处理（问题）；向…演讲",
          },
        ],
      },
    });

    expect(result).not.toBeNull();
    expect(result!.term).toBe("address");
    expect(result!.source).toBe("youdao");
    expect(result!.audioUrl).toContain("dict.youdao.com/dictvoice");
    expect(result!.partsOfSpeech[0]).toMatchObject({ label: "n." });
    expect(result!.partsOfSpeech[0].meanings).toContain("地址，住址");
    expect(result!.partsOfSpeech[1].label).toBe("v.");
    expect(result!.partsOfSpeech[1].meanings[0]).toBe("解决，处理（问题）");
  });

  it("returns null for empty or invalid payloads", () => {
    expect(parseYoudaoSuggest({ data: { entries: [] } })).toBeNull();
    expect(parseYoudaoSuggest({ data: {} })).toBeNull();
    expect(parseYoudaoSuggest({})).toBeNull();
    expect(parseYoudaoSuggest(null)).toBeNull();
  });

  it("splits half-width semicolons and drops the trailing proper-noun section", () => {
    // 真实返回：haste 的 explain 里分号半角全角混用，末尾还挂了【名】人名段落
    const result = parseYoudaoSuggest({
      data: {
        entries: [
          {
            entry: "haste",
            explain:
              "n. 仓促，急忙; v. <古>赶紧，匆忙；<古>催促; 【名】  （Haste）（英）黑斯特，（法）阿斯特",
          },
        ],
      },
    });

    expect(result).not.toBeNull();
    // 注意 <古> 这类标记会被 stripTags 当作标签去掉
    expect(result!.partsOfSpeech).toEqual([
      { label: "n.", meanings: ["仓促，急忙"] },
      { label: "v.", meanings: ["赶紧，匆忙", "催促"] },
    ]);
    expect(JSON.stringify(result!.partsOfSpeech)).not.toContain("黑斯特");
  });

  it("returns null when only a proper-noun section is present", () => {
    const result = parseYoudaoSuggest({
      data: { entries: [{ entry: "haste", explain: "【名】（Haste）（英）黑斯特" }] },
    });

    expect(result).toBeNull();
  });
});

describe("isSameTerm（防止把别的词的释义存到拼错的词下面）", () => {
  it("matches after normalization", () => {
    expect(isSameTerm("Address ", "address")).toBe(true);
    expect(isSameTerm("accepted   wisdom", "Accepted Wisdom")).toBe(true);
  });

  it("rejects a corrected spelling returned for a typo", () => {
    expect(isSameTerm("explode", "explod")).toBe(false);
    expect(isSameTerm("enormously", "enormorusly")).toBe(false);
    expect(isSameTerm("gaseous", "gase")).toBe(false);
    expect(isSameTerm(undefined, "gase")).toBe(false);
  });
});

describe("dictionary provider", () => {
  it("maps provider response into stable application fields", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          word: "address",
          phonetic: "/əˈdres/",
          phonetics: [
            { text: "/əˈdres/", audio: "https://example.com/address.mp3" },
          ],
          meanings: [
            {
              partOfSpeech: "verb",
              definitions: [{ definition: "deal with" }],
            },
          ],
        },
      ],
    });

    const provider = createDictionaryProvider({ fetcher });
    await expect(provider.lookup("address")).resolves.toMatchObject({
      term: "address",
      phonetic: "/əˈdres/",
      audioUrl: "https://example.com/address.mp3",
    });
  });

  it("accepts a single object response shape as well as an array", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        word: "fetch",
        phonetic: "/fetʃ/",
        meanings: [
          {
            partOfSpeech: "verb",
            definitions: [{ definition: "to sell for a price" }],
          },
        ],
      }),
    });

    const provider = createDictionaryProvider({ fetcher });
    const result = await provider.lookup("fetch");
    expect(result.partsOfSpeech[0]).toMatchObject({ label: "verb" });
    expect(result.partsOfSpeech[0].meanings).toContain("to sell for a price");
  });

  it("rejects a definition returned for a different word (misspelled query)", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        word: "explode",
        meanings: [
          { partOfSpeech: "verb", definitions: [{ definition: "to burst" }] },
        ],
      }),
    });

    const provider = createDictionaryProvider({ fetcher });
    await expect(provider.lookup("explod")).rejects.toBeInstanceOf(
      DictionaryNotFoundError,
    );
  });

  it("maps a 404 response to a not-found error", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    const provider = createDictionaryProvider({ fetcher });

    await expect(provider.lookup("zzz-no-such-word")).rejects.toBeInstanceOf(
      DictionaryNotFoundError,
    );
  });

  it("normalizes network failures into a stable service error", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const provider = createDictionaryProvider({ fetcher });

    await expect(provider.lookup("address")).rejects.toBeInstanceOf(
      DictionaryServiceError,
    );
  });

  it("normalizes invalid JSON into a stable service error", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    });
    const provider = createDictionaryProvider({ fetcher });

    await expect(provider.lookup("address")).rejects.toBeInstanceOf(
      DictionaryServiceError,
    );
  });

  it("requests the term through the public endpoint", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => [] });
    const provider = createDictionaryProvider({ fetcher });

    await provider.lookup("account for");
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.dictionaryapi.dev/api/v2/entries/en/account%20for",
      expect.anything(),
    );
  });
});
