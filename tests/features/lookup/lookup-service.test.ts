import { describe, expect, it } from 'vitest'
import { lookupLocalWord } from '../../../src/features/lookup/lookupService'

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
