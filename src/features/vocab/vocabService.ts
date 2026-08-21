import { normalizeTerm } from '../../lib/normalizeTerm'
import type { PublicVocabEntry, UserWord } from '../../types/domain'

const LOCAL_USER_ID = 'local'

function createId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`
}

function primaryMeaning(entry: PublicVocabEntry) {
  return entry.meanings[0]?.text ?? ''
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

  const merged = publicEntries.map((entry) => {
    const userWord = userByTerm.get(entry.normalizedTerm)

    if (!userWord) {
      return publicEntryToUserWord(entry)
    }

    return {
      ...userWord,
      sourceVocabKey: userWord.sourceVocabKey ?? entry.key,
      meanings: userWord.meanings.length > 0 ? userWord.meanings : entry.meanings,
      term: userWord.term || entry.term
    }
  })

  const publicTerms = new Set(publicEntries.map((entry) => entry.normalizedTerm))
  const customOnlyWords = userWords.filter((word) => !publicTerms.has(word.normalizedTerm))

  return [...merged, ...customOnlyWords]
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
