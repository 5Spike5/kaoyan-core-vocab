import { describe, expect, it } from 'vitest'
import { applyRating, createNewCard, hydrateCard, isDue } from '../../src/lib/fsrs'

describe('fsrs wrapper', () => {
  it('creates a serializable card and applies ratings with the official scheduler', () => {
    const now = new Date('2026-08-21T00:00:00.000Z')
    const card = createNewCard(now)

    expect(isDue(card, now)).toBe(true)

    const reviewed = applyRating(card, 'good', now)

    expect(reviewed.reps).toBe(1)
    expect(new Date(reviewed.due).getTime()).toBeGreaterThan(now.getTime())
    expect(hydrateCard(reviewed).due).toBeInstanceOf(Date)
  })
})
