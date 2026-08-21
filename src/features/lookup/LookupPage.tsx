import { BookPlus, Check, Loader2, Search, Volume2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { createLocalRepository } from '../../repositories/localRepository'
import { createUserWordFromLookup } from '../vocab/vocabService'
import { lookupWithCache } from './dictionaryApi'
import { createDictionaryProvider } from './dictionaryProvider'
import { enrichLookupWithDictionary, lookupLocalWord } from './lookupService'
import type { WordLookupResult } from './lookupTypes'

const LOCAL_USER_ID = 'local'

type LookupState =
  | { phase: 'idle' }
  | { phase: 'loading'; term: string }
  | { phase: 'done'; result: WordLookupResult }
  | { phase: 'error'; message: string }

export default function LookupPage() {
  const [term, setTerm] = useState('')
  const [state, setState] = useState<LookupState>({ phase: 'idle' })
  const [addedTerms, setAddedTerms] = useState<Set<string>>(new Set())

  const enrichWithDictionary = useCallback(async (localResult: WordLookupResult) => {
    try {
      const provider = createDictionaryProvider()
      const dictionary = await lookupWithCache(localResult.normalizedTerm, provider)
      const enriched = await enrichLookupWithDictionary(localResult, { lookup: async () => dictionary })

      setState((previous) =>
        previous.phase === 'done' && previous.result.normalizedTerm === localResult.normalizedTerm
          ? { phase: 'done', result: enriched }
          : previous
      )
    } catch {
      setState((previous) =>
        previous.phase === 'done' && previous.result.normalizedTerm === localResult.normalizedTerm
          ? {
              phase: 'done',
              result: { ...previous.result, sourceStatus: { ...previous.result.sourceStatus, dictionary: 'error' } }
            }
          : previous
      )
    }
  }, [])

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault()
      const query = term.trim()
      if (!query) {
        return
      }

      const localResult = lookupLocalWord(query)
      setState({ phase: 'done', result: localResult })

      // 本地结果先展示；公共词典异步补充，失败不影响本地结果。
      void enrichWithDictionary(localResult)
    },
    [enrichWithDictionary, term]
  )

  const handleAddToVocab = useCallback(async (result: WordLookupResult) => {
    const meaning = result.publicEntry?.meanings.map((item) => item.text).join('；') ?? ''
    const word = createUserWordFromLookup({
      term: result.term,
      meaning,
      sourceVocabKey: result.publicEntry?.key
    })

    const repository = createLocalRepository()
    try {
      await repository.upsertUserWord({ ...word, userId: LOCAL_USER_ID })
      setAddedTerms((previous) => new Set(previous).add(result.normalizedTerm))
    } finally {
      await repository.close()
    }
  }, [])

  return (
    <section className="page lookup-page" aria-labelledby="lookup-title">
      <div className="page-heading">
        <p className="eyebrow">LOOKUP</p>
        <h1 id="lookup-title">查词</h1>
        <p className="lede">先从本地考研语料和核心词表查，之后再接公共词典补充音标、英文释义和短语。</p>
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

      {state.phase === 'loading' ? (
        <p className="page-note" role="status">
          <Loader2 size={16} className="spin" aria-hidden="true" />
          正在查询…
        </p>
      ) : null}

      {state.phase === 'error' ? (
        <p className="page-note page-note-error" role="alert">
          {state.message}
        </p>
      ) : null}

      {state.phase === 'done' ? <LookupResultView result={state.result} addedTerms={addedTerms} onAdd={handleAddToVocab} /> : null}
    </section>
  )
}

function LookupResultView({
  result,
  addedTerms,
  onAdd
}: {
  result: WordLookupResult
  addedTerms: Set<string>
  onAdd(result: WordLookupResult): void
}) {
  const hasLocalData = result.publicEntry !== undefined || result.examStats.totalOccurrences > 0
  const alreadyAdded = addedTerms.has(result.normalizedTerm)

  if (!hasLocalData) {
    return (
      <div className="lookup-result" role="status">
        <h2>未找到本地记录</h2>
        <p>本地核心词库和考研语料中没有「{result.term}」。</p>
        {result.dictionary ? (
          <DictionaryBlock dictionary={result.dictionary} phonetic={result.phonetic} />
        ) : (
          <p className="dictionary-note">正在查询公共词典…</p>
        )}
        {!alreadyAdded ? (
          <button type="button" className="button button-primary" onClick={() => onAdd(result)}>
            <BookPlus size={16} aria-hidden="true" />
            加入生词库
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="lookup-result">
      <div className="lookup-heading">
        <div>
          <h2>{result.term}</h2>
          {result.publicEntry?.partOfSpeech ? <span className="lookup-pos">{result.publicEntry.partOfSpeech}</span> : null}
          {result.phonetic ? <span className="lookup-phonetic">{result.phonetic}</span> : null}
        </div>

        {alreadyAdded ? (
          <span className="added-badge" role="status">
            <Check size={14} aria-hidden="true" />
            已加入生词库
          </span>
        ) : (
          <button type="button" className="button button-primary" onClick={() => onAdd(result)}>
            <BookPlus size={16} aria-hidden="true" />
            加入生词库
          </button>
        )}
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
        <DictionaryBlock dictionary={result.dictionary} phonetic={result.phonetic} />
      ) : (
        <p className="dictionary-note" role="status">
          <Loader2 size={14} className="spin" aria-hidden="true" />
          正在查询公共词典…
        </p>
      )}

      {result.sourceStatus.dictionary === 'error' ? (
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
                <p>{example.sentence}</p>
                {example.translation ? <cite>{example.translation}</cite> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function playAudio(url: string) {
  const audio = new Audio(url)
  void audio.play().catch(() => {
    // 浏览器阻止自动播放时静默失败
  })
}

function DictionaryBlock({
  dictionary,
  phonetic
}: {
  dictionary: NonNullable<WordLookupResult['dictionary']>
  phonetic?: string
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
            {group.label ? <span className="dictionary-pos">{group.label}</span> : null}
            <ul className="meaning-list">
              {group.meanings.map((meaning, meaningIndex) => (
                <li key={`${meaning}-${meaningIndex}`}>{meaning}</li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  )
}
