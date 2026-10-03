import { describe, expect, it } from 'vitest'
import {
  countUniquePublicTerms,
  createUserWordFromLookup,
  hasWordMeaning,
  mergePublicAndUserWords,
  normalizeMeanings
} from '../../../src/features/vocab/vocabService'
import type { PublicVocabEntry, UserWord } from '../../../src/types/domain'

const fixtureEntries: PublicVocabEntry[] = [
  {
    key: 'address',
    term: 'address',
    normalizedTerm: 'address',
    partOfSpeech: 'v.',
    meanings: [{ text: '处理，应对', source: 'curated' }],
    category: '核心词',
    source: 'test'
  }
]

function userWord(overrides: Partial<UserWord>): UserWord {
  return {
    id: 'word-x',
    userId: 'local',
    term: 'address',
    normalizedTerm: 'address',
    meanings: [],
    status: 'new',
    tags: [],
    nextReviewAt: null,
    createdAt: 1,
    updatedAt: 2,
    ...overrides
  }
}

describe('vocab service', () => {
  it('creates a normalized local word from a lookup result', () => {
    const word = createUserWordFromLookup({
      term: '  Account   For ',
      meaning: '占比',
      sourceVocabKey: 'account for'
    })

    expect(word).toMatchObject({
      term: 'Account   For',
      normalizedTerm: 'account for',
      status: 'new',
      sourceVocabKey: 'account for'
    })
    expect(word.meanings).toEqual([{ text: '占比', source: 'user' }])
  })

  it('merges public entries without overwriting existing user words', () => {
    const publicEntries: PublicVocabEntry[] = [
      {
        key: 'address',
        term: 'address',
        normalizedTerm: 'address',
        partOfSpeech: 'v.',
        meanings: [{ text: '处理，应对', source: 'curated' }],
        category: '核心词',
        source: 'test'
      }
    ]
    const userWords: UserWord[] = [
      {
        id: 'word-1',
        userId: 'local',
        term: 'Address',
        normalizedTerm: 'address',
        meanings: [{ text: '我自己的释义', source: 'user' }],
        status: 'learning',
        notes: '重点',
        tags: ['阅读'],
        nextReviewAt: null,
        createdAt: 1,
        updatedAt: 2
      }
    ]

    const merged = mergePublicAndUserWords(publicEntries, userWords)

    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({
      id: 'word-1',
      meanings: [{ text: '我自己的释义', source: 'user' }],
      notes: '重点',
      sourceVocabKey: 'address'
    })
  })

  describe('meaning-less user words (查词写入的空释义)', () => {
    it('falls back to the curated meaning so the word stays studyable', () => {
      const merged = mergePublicAndUserWords(fixtureEntries, [
        userWord({ term: 'address', meanings: [] })
      ])

      expect(merged[0].meanings).toEqual([{ text: '处理，应对', source: 'curated' }])
      expect(hasWordMeaning(merged[0])).toBe(true)
    })

    it('ignores blank meaning text when deciding the fallback', () => {
      const merged = mergePublicAndUserWords(fixtureEntries, [
        userWord({ meanings: [{ text: '   ', source: 'user' }] })
      ])

      expect(merged[0].meanings).toEqual([{ text: '处理，应对', source: 'curated' }])
      expect(hasWordMeaning(merged[0])).toBe(true)
    })

    it('does not throw when a record has a corrupted meanings field', () => {
      const corrupted = userWord({ meanings: undefined as unknown as UserWord['meanings'] })

      expect(() => mergePublicAndUserWords(fixtureEntries, [corrupted])).not.toThrow()
      const merged = mergePublicAndUserWords(fixtureEntries, [corrupted])
      expect(merged[0].meanings).toEqual([{ text: '处理，应对', source: 'curated' }])
    })

    it('keeps custom words but sanitizes their meanings array', () => {
      const merged = mergePublicAndUserWords(fixtureEntries, [
        userWord({
          term: 'roam',
          normalizedTerm: 'roam',
          meanings: undefined as unknown as UserWord['meanings']
        })
      ])

      const custom = merged.find((word) => word.normalizedTerm === 'roam')
      expect(custom?.meanings).toEqual([])
      expect(hasWordMeaning(custom!)).toBe(false)
      expect(normalizeMeanings(custom?.meanings)).toEqual([])
    })
  })

  describe('重复的公共词条', () => {
    it('dedupes by normalizedTerm so the same word is not dealt twice', () => {
      const duplicated: PublicVocabEntry[] = [
        ...fixtureEntries,
        { ...fixtureEntries[0], key: 'address-highfreq', category: '高频词' }
      ]

      const merged = mergePublicAndUserWords(duplicated, [])

      expect(merged).toHaveLength(1)
      expect(countUniquePublicTerms(duplicated)).toBe(1)
    })

    it('counts unique public terms instead of raw entries', () => {
      expect(countUniquePublicTerms(fixtureEntries)).toBe(1)
      expect(countUniquePublicTerms([])).toBe(0)
    })
  })
})
