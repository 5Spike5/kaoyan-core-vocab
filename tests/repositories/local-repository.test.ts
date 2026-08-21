import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createLocalRepository } from '../../src/repositories/localRepository'
import type { ReviewLog, UserWord } from '../../src/types/domain'

describe('local repository', () => {
  it('upserts a word by user and normalized term', async () => {
    const repository = createLocalRepository({ name: `test-${crypto.randomUUID()}` })
    const firstWord: UserWord = {
      id: 'word-1',
      userId: 'user-1',
      term: 'Address',
      normalizedTerm: 'address',
      meanings: [{ text: '处理，应对', source: 'user' }],
      status: 'new',
      tags: [],
      nextReviewAt: null,
      createdAt: 1,
      updatedAt: 1
    }

    const first = await repository.upsertUserWord(firstWord)
    const second = await repository.upsertUserWord({
      ...first,
      id: 'word-2',
      notes: '重点复习',
      updatedAt: 2
    })

    expect(second.id).toBe(first.id)
    expect(second.notes).toBe('重点复习')
    expect(await repository.listUserWords('user-1')).toHaveLength(1)
    expect(await repository.getUserWord('user-1', 'address')).toMatchObject({ id: 'word-1' })
    await repository.close()
  })

  it('scopes words and logs by user id', async () => {
    const repository = createLocalRepository({ name: `test-${crypto.randomUUID()}` })
    await repository.upsertUserWord({
      id: 'word-1',
      userId: 'user-1',
      term: 'address',
      normalizedTerm: 'address',
      meanings: [],
      status: 'new',
      tags: [],
      nextReviewAt: null,
      createdAt: 1,
      updatedAt: 1
    })
    await repository.upsertUserWord({
      id: 'word-2',
      userId: 'user-2',
      term: 'address',
      normalizedTerm: 'address',
      meanings: [],
      status: 'new',
      tags: [],
      nextReviewAt: null,
      createdAt: 1,
      updatedAt: 1
    })

    const log: ReviewLog = {
      id: 'log-1',
      userId: 'user-1',
      wordId: 'word-1',
      normalizedTerm: 'address',
      rating: 3,
      answeredCorrectly: true,
      reviewedAt: 2,
      elapsedMs: 500
    }

    await repository.appendReviewLog(log)

    expect(await repository.listUserWords('user-1')).toHaveLength(1)
    expect(await repository.listUserWords('user-2')).toHaveLength(1)
    expect(await repository.listReviewLogs('user-1')).toEqual([log])
    expect(await repository.listReviewLogs('user-2')).toEqual([])
    await repository.close()
  })
})
