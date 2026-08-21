import { describe, expect, it } from 'vitest'
import { searchExamCorpus } from '../../src/data/corpusIndex'

describe('exam corpus index', () => {
  it('finds matching examples without requiring a network request', () => {
    const result = searchExamCorpus('address')

    expect(result.totalOccurrences).toBeGreaterThan(0)
    expect(result.examples.length).toBeGreaterThan(0)
    expect(result.examples[0].sentence.toLowerCase()).toContain('address')
  })

  it('matches phrases as normalized substrings', () => {
    const result = searchExamCorpus(' account   for ')

    expect(result.totalOccurrences).toBeGreaterThan(0)
    expect(result.examples.some((example) => example.sentence.toLowerCase().includes('account for'))).toBe(
      true
    )
  })
})
