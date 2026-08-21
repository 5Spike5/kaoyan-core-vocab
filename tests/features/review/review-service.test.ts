import { describe, expect, it } from 'vitest'
import { buildReviewOptions, rateReviewAnswer } from '../../../src/features/review/reviewService'

describe('review service', () => {
  it('creates four options with one correct answer', () => {
    const card = { term: 'address', meaning: '处理，应对' }
    const options = buildReviewOptions(card, [
      { term: 'address', meaning: '处理，应对' },
      { term: 'fetch', meaning: '售得' },
      { term: 'bid', meaning: '出价' },
      { term: 'peak', meaning: '顶峰' }
    ])

    expect(options).toHaveLength(4)
    expect(options.filter((option) => option.isCorrect)).toHaveLength(1)
    expect(new Set(options.map((option) => option.meaning)).size).toBe(4)
  })

  it('maps answer quality to an FSRS rating', () => {
    expect(rateReviewAnswer({ correct: true, attempts: 1 })).toBe('good')
    expect(rateReviewAnswer({ correct: true, attempts: 2 })).toBe('hard')
    expect(rateReviewAnswer({ correct: false, attempts: 1 })).toBe('again')
  })
})
