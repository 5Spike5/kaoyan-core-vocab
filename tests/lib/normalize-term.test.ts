import { describe, expect, it } from 'vitest'
import { normalizeTerm } from '../../src/lib/normalizeTerm'

describe('normalizeTerm', () => {
  it('normalizes case, spaces, and surrounding whitespace', () => {
    expect(normalizeTerm('  Account   For ')).toBe('account for')
    expect(normalizeTerm('BULL-RUN')).toBe('bull-run')
  })
})
