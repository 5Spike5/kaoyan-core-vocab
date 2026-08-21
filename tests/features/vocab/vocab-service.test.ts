import { describe, expect, it } from 'vitest'
import { createUserWordFromLookup, mergePublicAndUserWords } from '../../../src/features/vocab/vocabService'
import type { PublicVocabEntry, UserWord } from '../../../src/types/domain'

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
})
