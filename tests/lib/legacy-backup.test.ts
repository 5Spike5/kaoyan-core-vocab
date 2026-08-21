import { describe, expect, it } from 'vitest'
import { parseLegacyBackup } from '../../src/lib/legacyBackup'

describe('legacy backup parser', () => {
  const backup = JSON.stringify({
    dailyGoal: 80,
    todayDate: '2026-08-21',
    words: {
      address: {
        status: 'review',
        level: 2,
        stability: 12.6,
        difficulty: 4.17,
        nextReview: 1788489935146,
        lastReview: 1787193935146,
        firstLearned: 1786761769364,
        lastStudy: 1787193935146,
        correct: 7,
        wrong: -1,
        fsrs: {
          due: 1788489935146,
          stability: 12.6,
          difficulty: 4.17,
          elapsed_days: 4,
          scheduled_days: 15,
          reps: 6,
          lapses: -1,
          state: 2,
          step: null,
          last_review: 1787193935146
        },
        fsrsState: 'Review'
      },
      'my custom word': {
        status: 'learning',
        nextReview: null,
        firstLearned: 1786761769364,
        lastStudy: 1786761769364,
        correct: 1,
        wrong: 0,
        fsrs: null
      },
      guarantee: {
        status: 'ignored',
        stability: 2.15,
        difficulty: 4.18,
        nextReview: 1787140106321,
        firstLearned: 1786761769364,
        lastStudy: 1786761769364,
        correct: 5,
        wrong: 0
      }
    },
    _customVocab: [{ word: 'newword', meaning: '新词' }]
  })

  it('maps legacy statuses, fsrs cards, and review times to UserWords', () => {
    const result = parseLegacyBackup(backup)

    expect(result.dailyGoal).toBe(80)
    expect(result.words).toHaveLength(4)

    const address = result.words.find((word) => word.normalizedTerm === 'address')!
    expect(address.status).toBe('reviewing')
    expect(address.nextReviewAt).toBe(1788489935146)
    expect(address.fsrs).toBeDefined()
    expect(address.fsrs!.due).toBe(new Date(1788489935146).toISOString())
    expect(address.fsrs!.reps).toBe(6)
    // 负 lapses 会被钳制为 0
    expect(address.fsrs!.lapses).toBe(0)
    // 释义来自公共词库
    expect(address.meanings.length).toBeGreaterThan(0)

    const learning = result.words.find((word) => word.normalizedTerm === 'my custom word')!
    expect(learning.status).toBe('learning')
    // fsrs 为 null 时转为 undefined
    expect(learning.fsrs).toBeUndefined()
    expect(learning.nextReviewAt).toBeNull()

    const ignored = result.words.find((word) => word.normalizedTerm === 'guarantee')!
    expect(ignored.status).toBe('suspended')
    expect(ignored.fsrs).toBeUndefined()
    expect(ignored.nextReviewAt).toBe(1787140106321)

    const custom = result.words.find((word) => word.normalizedTerm === 'newword')!
    expect(custom.status).toBe('new')
    expect(custom.meanings[0]?.text).toBe('新词')
  })

  it('rejects invalid files', () => {
    expect(() => parseLegacyBackup('not json')).toThrow(/无法解析/)
    expect(() => parseLegacyBackup('{"foo": 1}')).toThrow(/words/)
  })
})
