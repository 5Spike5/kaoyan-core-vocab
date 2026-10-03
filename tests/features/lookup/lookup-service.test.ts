import { describe, expect, it } from 'vitest'
import {
  LOOKUP_MEANING_MAX_LENGTH,
  lookupLocalWord,
  meaningFromLookupResult
} from '../../../src/features/lookup/lookupService'
import type { WordLookupResult } from '../../../src/features/lookup/lookupTypes'

describe('lookupLocalWord', () => {
  it('combines public meanings with exam corpus counts and examples', () => {
    const result = lookupLocalWord('address')

    expect(result.normalizedTerm).toBe('address')
    expect(result.publicEntry?.term).toBe('address')
    expect(result.examStats.totalOccurrences).toBeGreaterThan(0)
    expect(result.examples.length).toBeGreaterThan(0)
    expect(result.sourceStatus.localCorpus).toBe('hit')
  })

  it('returns a miss result for unknown terms without throwing', () => {
    const result = lookupLocalWord('zzz-no-such-word')

    expect(result.publicEntry).toBeUndefined()
    expect(result.examStats.totalOccurrences).toBe(0)
    expect(result.sourceStatus.localCorpus).toBe('miss')
  })

  it('normalizes case and whitespace before searching', () => {
    const upper = lookupLocalWord('  ACCOUNT   FOR ')
    const lower = lookupLocalWord('account for')

    expect(upper.normalizedTerm).toBe('account for')
    expect(upper.examStats.totalOccurrences).toBe(lower.examStats.totalOccurrences)
  })
})

describe('meaningFromLookupResult', () => {
  /** 查文章里的生词：核心词库没有它，只有公共词典结果 */
  function dictionaryOnly(term: string): WordLookupResult {
    const base = lookupLocalWord(term)
    return {
      ...base,
      dictionary: {
        term,
        partsOfSpeech: [
          { label: 'n.', meanings: ['漫步', '漫游'] },
          { label: 'v.', meanings: ['闲逛'] }
        ],
        source: 'youdao'
      }
    }
  }

  it('prefers the curated core-vocab meaning', () => {
    const result = lookupLocalWord('address')

    expect(meaningFromLookupResult(result)).toBe(
      result.publicEntry!.meanings.map((item) => item.text).join('；')
    )
  })

  it('falls back to the public dictionary when the term is not in the core vocab', () => {
    const result = dictionaryOnly('roam')

    expect(result.publicEntry).toBeUndefined()
    expect(meaningFromLookupResult(result)).toBe('n. 漫步；漫游；v. 闲逛')
  })

  it('returns an empty string when no source has a meaning', () => {
    expect(meaningFromLookupResult(lookupLocalWord('zzz-no-such-word'))).toBe('')
  })

  it('truncates over-long dictionary meanings', () => {
    const base = lookupLocalWord('zzz-no-such-word')
    const long = '很长的释义'.repeat(60)
    const result: WordLookupResult = {
      ...base,
      dictionary: { term: 'zzz-no-such-word', partsOfSpeech: [{ label: '', meanings: [long] }], source: 'youdao' }
    }

    const meaning = meaningFromLookupResult(result)
    expect(meaning.length).toBe(LOOKUP_MEANING_MAX_LENGTH + 1)
    expect(meaning.endsWith('…')).toBe(true)
  })

  it('drops blank dictionary entries instead of storing whitespace', () => {
    const base = lookupLocalWord('zzz-no-such-word')
    const result: WordLookupResult = {
      ...base,
      dictionary: { term: 'x', partsOfSpeech: [{ label: 'n.', meanings: ['  ', ''] }], source: 'youdao' }
    }

    expect(meaningFromLookupResult(result)).toBe('')
  })
})
