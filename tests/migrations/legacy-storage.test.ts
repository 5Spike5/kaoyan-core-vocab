import { describe, expect, it } from 'vitest'
import { readLegacyStorage } from '../../src/migrations/legacyStorage'

describe('readLegacyStorage', () => {
  it('returns current user, custom words, progress records, and sessions', () => {
    localStorage.clear()
    localStorage.setItem('currentUser', 'local-student')
    localStorage.setItem('customVocab', JSON.stringify([{ word: 'address', meaning: '处理' }]))
    localStorage.setItem('wordProgress:address', JSON.stringify({ word: 'address', reps: 2 }))
    localStorage.setItem('studySession:active', JSON.stringify({ currentIndex: 1 }))
    localStorage.setItem('unrelated:broken', '{bad-json')

    const snapshot = readLegacyStorage(localStorage)

    expect(snapshot.currentUser).toBe('local-student')
    expect(snapshot.customVocab).toEqual([{ word: 'address', meaning: '处理' }])
    expect(snapshot.progressRecords).toEqual([
      { key: 'wordProgress:address', value: { word: 'address', reps: 2 } }
    ])
    expect(snapshot.sessions).toEqual([{ key: 'studySession:active', value: { currentIndex: 1 } }])
  })
})
