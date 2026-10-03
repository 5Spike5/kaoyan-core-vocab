import { normalizeTerm } from '../../lib/normalizeTerm'
import type { PublicVocabEntry, UserWord, WordMeaning } from '../../types/domain'

const LOCAL_USER_ID = 'local'

function createId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`
}

function primaryMeaning(entry: PublicVocabEntry) {
  return entry.meanings[0]?.text ?? ''
}

/**
 * 清洗释义数组：历史数据/跨端同步可能带来非数组或空文本，直接丢给
 * `meanings[0].text` 读取会抛错或让整页学习队列变空，统一在这里兜住。
 */
export function normalizeMeanings(meanings: WordMeaning[] | undefined | null): WordMeaning[] {
  if (!Array.isArray(meanings)) {
    return []
  }

  return meanings.filter(
    (item) => item && typeof item.text === 'string' && item.text.trim().length > 0
  )
}

/** 有可用释义的词才进得了学习队列（选项需要释义做干扰项）。 */
export function hasWordMeaning(word: Pick<UserWord, 'meanings'>): boolean {
  return normalizeMeanings(word.meanings).length > 0
}

function publicEntryToUserWord(entry: PublicVocabEntry): UserWord {
  return {
    id: `public-${entry.key}`,
    userId: LOCAL_USER_ID,
    term: entry.term,
    normalizedTerm: entry.normalizedTerm,
    meanings: entry.meanings,
    status: 'new',
    sourceVocabKey: entry.key,
    tags: [],
    nextReviewAt: null,
    createdAt: 0,
    updatedAt: 0
  }
}

export function mergePublicAndUserWords(
  publicEntries: PublicVocabEntry[],
  userWords: UserWord[]
): UserWord[] {
  const userByTerm = new Map(userWords.map((word) => [word.normalizedTerm, word]))

  // 公共词表里有重复词条（同一个 normalizedTerm 出现多次，来自不同批次的导入）。
  // 不去重会出现两个问题：同一个词在一次背诵里被发两次；首页「待学/词库」按
  // 条目数统计，虚增出几十个并不存在的待学词。
  const seenPublicTerms = new Set<string>()
  const uniquePublicEntries = publicEntries.filter((entry) => {
    if (seenPublicTerms.has(entry.normalizedTerm)) {
      return false
    }
    seenPublicTerms.add(entry.normalizedTerm)
    return true
  })

  const merged = uniquePublicEntries.map((entry) => {
    const userWord = userByTerm.get(entry.normalizedTerm)

    if (!userWord) {
      return publicEntryToUserWord(entry)
    }

    // 用户记录里的释义为空（例如旧版查词写入的空释义词）时回退到核心词库释义，
    // 否则这个词会因为「没有释义」被学习队列静默排除
    const userMeanings = normalizeMeanings(userWord.meanings)

    return {
      ...userWord,
      sourceVocabKey: userWord.sourceVocabKey ?? entry.key,
      meanings: userMeanings.length > 0 ? userMeanings : entry.meanings,
      term: userWord.term || entry.term
    }
  })

  const customOnlyWords = userWords
    .filter((word) => !seenPublicTerms.has(word.normalizedTerm))
    .map((word) => ({ ...word, meanings: normalizeMeanings(word.meanings) }))

  return [...merged, ...customOnlyWords]
}

/** 公共词表去重后的词条数（首页统计用，避免重复条目虚增待学数量）。 */
export function countUniquePublicTerms(publicEntries: PublicVocabEntry[]): number {
  return new Set(publicEntries.map((entry) => entry.normalizedTerm)).size
}

/**
 * 只替换释义，保留 id / status / FSRS / 下次复习时间。
 * 导入词表、补全释义、补充释义都必须走这里：直接从零构造词对象会把已学词
 * 打回「未学」，抹掉复习进度（导入一份含已学词的表就中招）。
 */
export function withUpdatedMeaning(
  word: UserWord,
  meaning: string,
  source: WordMeaning['source'] = 'user'
): UserWord {
  const text = meaning.trim()
  return {
    ...word,
    meanings: text ? [{ text, source }] : normalizeMeanings(word.meanings),
    updatedAt: Date.now()
  }
}

export function createUserWordFromLookup(input: {
  term: string
  meaning: string
  sourceVocabKey?: string
}): UserWord {
  const term = input.term.trim()
  const now = Date.now()

  if (!term) {
    throw new Error('Word term is required')
  }

  return {
    id: createId('word'),
    userId: LOCAL_USER_ID,
    term,
    normalizedTerm: normalizeTerm(term),
    meanings: input.meaning.trim() ? [{ text: input.meaning.trim(), source: 'user' }] : [],
    status: 'new',
    sourceVocabKey: input.sourceVocabKey,
    tags: [],
    nextReviewAt: null,
    createdAt: now,
    updatedAt: now
  }
}

export function publicEntryToReviewCandidate(entry: PublicVocabEntry) {
  return {
    term: entry.term,
    meaning: primaryMeaning(entry)
  }
}
