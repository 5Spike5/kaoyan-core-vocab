import { describe, expect, it, vi } from "vitest";
import {
  createDictionaryProvider,
  DictionaryNotFoundError,
  DictionaryServiceError,
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
