import type {
  DictionaryProvider,
  DictionaryResult,
  PartOfSpeechGroup,
} from "./lookupTypes";

export class DictionaryNotFoundError extends Error {
  constructor(term: string) {
    super(`词典中未找到「${term}」`);
    this.name = "DictionaryNotFoundError";
  }
}

export class DictionaryServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DictionaryServiceError";
  }
}

/* ============ 有道词典（JSONP，国内直连，免费无需 key） ============ */

const YOUDAO_SUGGEST =
  "https://dict.youdao.com/suggest?num=5&doctype=json&le=en&q=";

type YoudaoSuggestEntry = {
  entry?: string;
  explain?: string;
  phonetic?: string;
};

type YoudaoSuggestPayload = {
  data?: {
    entries?: YoudaoSuggestEntry[];
  };
};

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, "").trim();
}

/** 解析有道的 explain（如 "n. 地址；网址；演讲；v. 解决，处理"）为词性分组。 */
export function parseYoudaoSuggest(payload: unknown): DictionaryResult | null {
  const data = payload as YoudaoSuggestPayload;
  const entries = data?.data?.entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    return null;
  }

  const entry = entries[0];
  const term = entry?.entry?.trim();
  const explain = entry?.explain?.trim();
  if (!term || !explain) {
    return null;
  }

  const groups: PartOfSpeechGroup[] = [];
  for (const rawSegment of explain.split("；")) {
    const segment = stripTags(rawSegment);
    if (!segment) {
      continue;
    }
    const posMatch = segment.match(/^([a-zA-Z]+\.)\s*(.+)$/);
    if (posMatch) {
      groups.push({ label: posMatch[1], meanings: [posMatch[2]] });
    } else if (groups.length > 0) {
      groups[groups.length - 1].meanings.push(segment);
    } else {
      groups.push({ label: "", meanings: [segment] });
    }
  }

  return {
    term,
    phonetic: entry.phonetic?.trim() || undefined,
    audioUrl: `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(term)}&type=2`,
    partsOfSpeech: groups,
    source: "youdao",
  };
}

/** JSONP 请求（测试环境不支持真实 script 加载，直接失败以走兜底链路）。 */
function jsonpRequest(url: string, timeoutMs = 5000): Promise<unknown> {
  if (import.meta.env.MODE === "test") {
    return Promise.reject(
      new DictionaryServiceError("测试环境不发起 JSONP 请求"),
    );
  }

  return new Promise((resolve, reject) => {
    const callbackName = `__youdao_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const script = document.createElement("script");
    let timer = 0;

    const cleanup = () => {
      window.clearTimeout(timer);
      delete (window as unknown as Record<string, unknown>)[callbackName];
      script.remove();
    };

    (window as unknown as Record<string, unknown>)[callbackName] = (
      data: unknown,
    ) => {
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      cleanup();
      reject(new DictionaryServiceError("词典服务不可用"));
    };
    timer = window.setTimeout(() => {
      cleanup();
      reject(new DictionaryServiceError("词典查询超时"));
    }, timeoutMs);

    script.src = `${url}${url.includes("?") ? "&" : "?"}callback=${encodeURIComponent(callbackName)}`;
    document.body.appendChild(script);
  });
}

export function createYoudaoProvider(): DictionaryProvider {
  return {
    async lookup(term: string) {
      const query = term.trim();
      const payload = await jsonpRequest(
        `${YOUDAO_SUGGEST}${encodeURIComponent(query)}`,
      );
      const result = parseYoudaoSuggest(payload);
      if (!result) {
        throw new DictionaryNotFoundError(query);
      }
      return result;
    },
  };
}

/* ============ Free Dictionary API（兜底，提供音标） ============ */

const FREE_DICTIONARY_ENDPOINT =
  "https://api.dictionaryapi.dev/api/v2/entries/en/";

type FreeDictionaryDefinition = {
  definition?: string;
};

type FreeDictionaryMeaning = {
  partOfSpeech?: string;
  definitions?: FreeDictionaryDefinition[];
};

type FreeDictionaryEntry = {
  word?: string;
  phonetic?: string;
  phonetics?: Array<{ text?: string; audio?: string }>;
  meanings?: FreeDictionaryMeaning[];
};

function firstAudio(entry: FreeDictionaryEntry): string | undefined {
  const audio = entry.phonetics?.find((item) => item.audio);
  return audio?.audio;
}

function mapEntry(entry: FreeDictionaryEntry): DictionaryResult {
  const groups: PartOfSpeechGroup[] = [];

  for (const meaning of entry.meanings ?? []) {
    const definitions = (meaning.definitions ?? [])
      .map((item) => item.definition?.trim())
      .filter((item): item is string => Boolean(item));

    if (!meaning.partOfSpeech && definitions.length === 0) {
      continue;
    }

    const existing = groups.find(
      (group) => group.label === (meaning.partOfSpeech ?? ""),
    );
    if (existing) {
      existing.meanings.push(...definitions);
    } else {
      groups.push({ label: meaning.partOfSpeech ?? "", meanings: definitions });
    }
  }

  return {
    term: entry.word ?? "",
    phonetic: entry.phonetic,
    audioUrl: firstAudio(entry),
    partsOfSpeech: groups,
    source: "dictionaryapi.dev",
  };
}

export function createFreeDictionaryProvider(
  fetcher: typeof fetch = fetch,
): DictionaryProvider {
  return {
    async lookup(term: string) {
      const endpoint = `${FREE_DICTIONARY_ENDPOINT}${encodeURIComponent(term.trim())}`;

      let response: Response;
      try {
        response = await fetcher(endpoint, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(8000),
        });
      } catch (error) {
        throw new DictionaryServiceError(
          `词典服务不可用：${error instanceof Error ? error.message : "网络错误"}`,
        );
      }

      if (response.status === 404) {
        throw new DictionaryNotFoundError(term);
      }

      if (!response.ok) {
        throw new DictionaryServiceError(
          `词典服务返回异常状态：${response.status}`,
        );
      }

      let payload: FreeDictionaryEntry | FreeDictionaryEntry[];
      try {
        payload = (await response.json()) as
          FreeDictionaryEntry | FreeDictionaryEntry[];
      } catch {
        throw new DictionaryServiceError("词典服务返回了无法解析的数据");
      }

      const entries = Array.isArray(payload) ? payload : [payload];
      const entry = entries.find((item) => item.word) ?? entries[0];

      if (!entry) {
        return { term: "", partsOfSpeech: [], source: "dictionaryapi.dev" };
      }

      return mapEntry(entry);
    },
  };
}

/* ============ 组合：国内有道优先，失败回退 Free Dictionary API ============ */

export function createDictionaryProvider(options?: {
  fetcher?: typeof fetch;
}): DictionaryProvider {
  const youdao = createYoudaoProvider();
  const freeDictionary = createFreeDictionaryProvider(options?.fetcher);

  return {
    async lookup(term: string) {
      try {
        return await youdao.lookup(term);
      } catch (error) {
        try {
          return await freeDictionary.lookup(term);
        } catch (fallbackError) {
          // 兜底明确“未找到”时优先抛出该错误；其余情况保留首选源的错误
          if (fallbackError instanceof DictionaryNotFoundError) {
            throw fallbackError;
          }
          throw error;
        }
      }
    },
  };
}
