import { describe, expect, it } from 'vitest'
import { publicVocab } from '../../src/data/publicVocab'

describe('public vocabulary import', () => {
  it('contains normalized unique terms and preserves the legacy corpus size', () => {
    const keys = publicVocab.map((entry) => entry.key)

    expect(publicVocab.length).toBeGreaterThanOrEqual(1_398)
    expect(new Set(keys).size).toBe(keys.length)
    expect(publicVocab.find((entry) => entry.term === 'address')).toMatchObject({
      normalizedTerm: 'address'
    })
  })
})
