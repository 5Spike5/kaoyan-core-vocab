import { BookPlus, Check, Loader2, Search, Volume2 } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "../../components/Toast";
import { createLocalRepository } from "../../repositories/localRepository";
import {
  createUserWordFromLookup,
  hasWordMeaning,
} from "../vocab/vocabService";
import { lookupWithCache } from "./dictionaryApi";
import { createDictionaryProvider } from "./dictionaryProvider";
import { highlightTerm } from "../../lib/highlightTerm";
import {
  enrichLookupWithDictionary,
  lookupLocalWord,
  meaningFromLookupResult,
} from "./lookupService";
import type { WordLookupResult } from "./lookupTypes";

const LOCAL_USER_ID = "local";

type LookupState =
  | { phase: "idle" }
  | { phase: "loading"; term: string }
  | { phase: "done"; result: WordLookupResult }
  | { phase: "error"; message: string };

export default function LookupPage() {
  const [term, setTerm] = useState("");
  const [state, setState] = useState<LookupState>({ phase: "idle" });
  const [addedTerms, setAddedTerms] = useState<Set<string>>(new Set());
  // 本地生词库里已存在的词（查到了就不显示“加入生词库”按钮）
  const [knownTerms, setKnownTerms] = useState<Set<string>>(new Set());
  // 已在生词库、但当初没有存下释义的词（旧版查词留下的脏数据）：允许重新补释义
  const [meaninglessTerms, setMeaninglessTerms] = useState<Set<string>>(
    new Set(),
  );
  // 字典结果还在路上时先别让用户点“加入生词库”，否则会存进空释义
  const [enriching, setEnriching] = useState(false);

  const checkKnown = useCallback(async (result: WordLookupResult) => {
    const repository = createLocalRepository();
    try {
      const existing = await repository.getUserWord(
        LOCAL_USER_ID,
        result.normalizedTerm,
      );
      if (existing) {
        if (hasWordMeaning(existing)) {
          setKnownTerms((previous) =>
            new Set(previous).add(result.normalizedTerm),
          );
        } else {
          setMeaninglessTerms((previous) =>
            new Set(previous).add(result.normalizedTerm),
          );
        }
      }
    } finally {
      await repository.close();
    }
  }, []);

  const enrichWithDictionary = useCallback(
    async (localResult: WordLookupResult) => {
      setEnriching(true);
      try {
        const provider = createDictionaryProvider();
        const dictionary = await lookupWithCache(
          localResult.normalizedTerm,
          provider,
        );
        const enriched = await enrichLookupWithDictionary(localResult, {
          lookup: async () => dictionary,
        });

        setState((previous) =>
          previous.phase === "done" &&
          previous.result.normalizedTerm === localResult.normalizedTerm
            ? { phase: "done", result: enriched }
            : previous,
        );
      } catch {
        setState((previous) =>
          previous.phase === "done" &&
          previous.result.normalizedTerm === localResult.normalizedTerm
            ? {
                phase: "done",
                result: {
                  ...previous.result,
                  sourceStatus: {
                    ...previous.result.sourceStatus,
                    dictionary: "error",
                  },
                },
              }
            : previous,
        );
      } finally {
        setEnriching(false);
      }
    },
    [],
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const query = term.trim();
      if (!query) {
        return;
      }

      const localResult = lookupLocalWord(query);
      setState({ phase: "done", result: localResult });

      // 本地结果先展示；公共词典异步补充，失败不影响本地结果。
      void enrichWithDictionary(localResult);
      // 查一下该词是否已在生词库，避免重复添加
      void checkKnown(localResult);
    },
    [checkKnown, enrichWithDictionary, term],
  );

  const handleAddToVocab = useCallback(async (result: WordLookupResult) => {
    // 释义优先级：核心词库 → 公共词典 → 已解析分组。
    // 不能只看核心词库：查文章里的生词时它在核心词库里通常没有条目，
    // 存成空释义会让这个词永远进不了背诵队列（学习队列按“有释义”过滤）。
    const meaning = meaningFromLookupResult(result);
    if (!meaning) {
      toast("暂时没拿到这个词的释义，稍后再试一次", "error");
      return;
    }

    const repository = createLocalRepository();
    try {
      // 已有记录（多为旧版写入的空释义词）只补释义，状态 / 复习计划保持原样
      const existing = await repository.getUserWord(
        LOCAL_USER_ID,
        result.normalizedTerm,
      );
      const word = existing
        ? {
            ...existing,
            meanings: [{ text: meaning, source: "user" as const }],
            sourceVocabKey: existing.sourceVocabKey ?? result.publicEntry?.key,
            updatedAt: Date.now(),
          }
        : createUserWordFromLookup({
            term: result.term,
            meaning,
            sourceVocabKey: result.publicEntry?.key,
          });

      await repository.upsertUserWord({ ...word, userId: LOCAL_USER_ID });
      setAddedTerms((previous) => new Set(previous).add(result.normalizedTerm));
      setMeaninglessTerms((previous) => {
        if (!previous.has(result.normalizedTerm)) {
          return previous;
        }
        const next = new Set(previous);
        next.delete(result.normalizedTerm);
        return next;
      });
      toast(
        existing ? "已补充释义，可以去背诵了" : "已添加成功，可在首页词库查看",
        "success",
      );
    } finally {
      await repository.close();
    }
  }, []);

  return (
    <section className="page lookup-page" aria-labelledby="lookup-title">
      <div className="page-heading">
        <p className="eyebrow">LOOKUP</p>
        <h1 id="lookup-title">查词</h1>
        <p className="lede">
          先从本地考研语料和核心词表查，之后再接公共词典补充音标、英文释义和短语。
        </p>
      </div>

      <form className="lookup-form" role="search" onSubmit={handleSubmit}>
        <label htmlFor="lookup-term">输入单词或短语</label>
        <div className="search-row">
          <input
            id="lookup-term"
            name="term"
            type="search"
            placeholder="address / account for"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="icon-button" aria-label="搜索">
            <Search size={20} aria-hidden="true" />
          </button>
        </div>
      </form>

      {state.phase === "loading" ? (
        <p className="page-note" role="status">
          <Loader2 size={16} className="spin" aria-hidden="true" />
          正在查询…
        </p>
      ) : null}

      {state.phase === "error" ? (
        <p className="page-note page-note-error" role="alert">
          {state.message}
        </p>
      ) : null}

      {state.phase === "done" ? (
        <LookupResultView
          result={state.result}
          addedTerms={addedTerms}
          knownTerms={knownTerms}
          meaninglessTerms={meaninglessTerms}
          enriching={enriching}
          onAdd={handleAddToVocab}
        />
      ) : null}
    </section>
  );
}

function LookupResultView({
  result,
  addedTerms,
  knownTerms,
  meaninglessTerms,
  enriching,
  onAdd,
}: {
  result: WordLookupResult;
  addedTerms: Set<string>;
  knownTerms: Set<string>;
  meaninglessTerms: Set<string>;
  enriching: boolean;
  onAdd(result: WordLookupResult): void;
}) {
  const hasLocalData =
    result.publicEntry !== undefined || result.examStats.totalOccurrences > 0;
  const alreadyAdded = addedTerms.has(result.normalizedTerm);
  const alreadyInVocab = alreadyAdded || knownTerms.has(result.normalizedTerm);
  const vocabBadgeText = alreadyAdded ? "已加入生词库" : "已在生词库";
  // 生词库里存在、但没有释义（旧版查词留下的）：允许重新补一次释义
  const needsMeaning = meaninglessTerms.has(result.normalizedTerm);
  // 没有核心词库释义、词典结果又还没回来时先禁用按钮，避免又存进空释义
  const waitingForMeaning =
    enriching && !result.publicEntry && !result.dictionary;

  const addAction = alreadyInVocab ? (
    <span className="added-badge" role="status">
      <Check size={14} aria-hidden="true" />
      {vocabBadgeText}
    </span>
  ) : (
    <>
      {needsMeaning ? (
        <p className="dictionary-note" role="status">
          这个词在生词库里还没有释义，补充释义后即可进入背诵。
        </p>
      ) : null}
      <button
        type="button"
        className="button button-primary"
        disabled={waitingForMeaning}
        onClick={() => onAdd(result)}
      >
        <BookPlus size={16} aria-hidden="true" />
        {needsMeaning
          ? "补充释义"
          : waitingForMeaning
            ? "正在获取释义…"
            : "加入生词库"}
      </button>
    </>
  );

  if (!hasLocalData) {
    return (
      <div className="lookup-result" role="status">
        <h2>未找到本地记录</h2>
        <p>本地核心词库和考研语料中没有「{result.term}」。</p>
        {result.dictionary ? (
          <DictionaryBlock
            dictionary={result.dictionary}
            phonetic={result.phonetic}
          />
        ) : (
          <p className="dictionary-note">正在查询公共词典…</p>
        )}
        {addAction}
      </div>
    );
  }

  return (
    <div className="lookup-result">
      <div className="lookup-heading">
        <div>
          <h2>{result.term}</h2>
          {result.publicEntry?.partOfSpeech ? (
            <span className="lookup-pos">
              {result.publicEntry.partOfSpeech}
            </span>
          ) : null}
          {result.phonetic ? (
            <span className="lookup-phonetic">{result.phonetic}</span>
          ) : null}
        </div>

        {addAction}
      </div>

      {result.publicEntry ? (
        <section className="lookup-block" aria-label="本地释义">
          <h3>
            <span className="source-tag source-tag-vocab">核心词库</span>
            释义
          </h3>
          <ul className="meaning-list">
            {result.publicEntry.meanings.map((meaning, index) => (
              <li key={`${meaning.text}-${index}`}>{meaning.text}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {result.dictionary ? (
        <DictionaryBlock
          dictionary={result.dictionary}
          phonetic={result.phonetic}
        />
      ) : (
        <p className="dictionary-note" role="status">
          <Loader2 size={14} className="spin" aria-hidden="true" />
          正在查询公共词典…
        </p>
      )}

      {result.sourceStatus.dictionary === "error" ? (
        <p className="dictionary-note" role="status">
          公共词典暂时不可用，以上为本地语料结果。
        </p>
      ) : null}

      <section className="lookup-block" aria-label="考研语料统计">
        <h3>
          <span className="source-tag source-tag-corpus">考研真题语料</span>
          出现情况
        </h3>
        <div className="corpus-stats">
          <div>
            <strong>{result.examStats.totalOccurrences}</strong>
            <span>总出现次数</span>
          </div>
          <div>
            <strong>{result.examStats.exampleCount}</strong>
            <span>例句数量</span>
          </div>
        </div>
      </section>

      {result.examples.length > 0 ? (
        <section className="lookup-block" aria-label="真题例句">
          <h3>真题例句</h3>
          <ul className="example-list">
            {result.examples.slice(0, 5).map((example) => (
              <li key={example.id}>
                <p>{highlightTerm(example.sentence, result.term)}</p>
                {example.translation ? (
                  <cite>{example.translation}</cite>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function playAudio(url: string) {
  const audio = new Audio(url);
  void audio.play().catch(() => {
    // 浏览器阻止自动播放时静默失败
  });
}

function DictionaryBlock({
  dictionary,
  phonetic,
}: {
  dictionary: NonNullable<WordLookupResult["dictionary"]>;
  phonetic?: string;
}) {
  return (
    <section className="lookup-block" aria-label="公共词典释义">
      <h3>
        <span className="source-tag source-tag-dictionary">公共词典</span>
        词典释义
        {phonetic ? <span className="lookup-phonetic">{phonetic}</span> : null}
        {dictionary.audioUrl ? (
          <button
            type="button"
            className="audio-button"
            aria-label="播放发音"
            onClick={() => playAudio(dictionary.audioUrl as string)}
          >
            <Volume2 size={16} aria-hidden="true" />
          </button>
        ) : null}
      </h3>

      {dictionary.partsOfSpeech.length === 0 ? (
        <p className="dictionary-note">公共词典未返回释义。</p>
      ) : (
        dictionary.partsOfSpeech.map((group, index) => (
          <div key={`${group.label}-${index}`} className="dictionary-group">
            {group.label ? (
              <span className="dictionary-pos">{group.label}</span>
            ) : null}
            <ul className="meaning-list">
              {group.meanings.map((meaning, meaningIndex) => (
                <li key={`${meaning}-${meaningIndex}`}>{meaning}</li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
