import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import { createLocalDb, type SyncOperation } from '../../src/repositories/localDb'
import {
  enqueueSyncOperation,
  flushSyncQueue,
  listPendingSyncOperations,
  mergeReviewLogs,
  mergeUserWord,
  removeSyncOperation
} from '../../src/repositories/syncService'

describe('sync merge rules', () => {
  it('chooses the newer word record by updatedAt', () => {
    const local = { id: 'word-1', userId: 'user-1', normalizedTerm: 'address', updatedAt: 10 }
    const remote = { ...local, updatedAt: 20, notes: 'cloud note' }

    expect(mergeUserWord(local, remote)).toEqual(remote)
    expect(mergeUserWord(remote, local)).toEqual(remote)
  })

  it('appends review logs and deduplicates by id', () => {
    const merged = mergeReviewLogs([{ id: 'log-1' }], [{ id: 'log-1' }, { id: 'log-2' }])
    expect(merged).toHaveLength(2)
  })
})

describe('sync queue', () => {
  it('flushes operations in creation order and removes only successful ones', async () => {
    const db = createLocalDb(`test-sync-${crypto.randomUUID()}`)
    const userId = 'user-1'

    const first = await enqueueSyncOperation(db, { userId, kind: 'upsert-word', payload: { term: 'first' } })
    const second = await enqueueSyncOperation(db, { userId, kind: 'upsert-word', payload: { term: 'second' } })

    expect(await listPendingSyncOperations(db, userId)).toHaveLength(2)

    const remote = {
      upsertWord: vi.fn().mockResolvedValue(undefined),
      appendReviewLog: vi.fn().mockResolvedValue(undefined),
      upsertSession: vi.fn().mockRejectedValue(new Error('network down'))
    }

    const firstResult = await flushSyncQueue(db, userId, remote as never)
    expect(firstResult.succeeded).toBe(2)
    expect(firstResult.failed).toBe(0)
    expect(remote.upsertWord).toHaveBeenCalledTimes(2)
    expect(remote.upsertWord.mock.calls[0][0]).toEqual({ term: 'first' })
    expect(remote.upsertWord.mock.calls[1][0]).toEqual({ term: 'second' })
    expect(await listPendingSyncOperations(db, userId)).toHaveLength(0)

    // 队列为空时不再调用远端
    await flushSyncQueue(db, userId, remote as never)
    expect(remote.upsertWord).toHaveBeenCalledTimes(2)

    // 失败的操作保留并记录错误
    await enqueueSyncOperation(db, { userId, kind: 'upsert-session', payload: { id: 'session-1' } })
    const secondResult = await flushSyncQueue(db, userId, remote as never)
    expect(secondResult.succeeded).toBe(0)
    expect(secondResult.failed).toBe(1)
    const pending: SyncOperation[] = await listPendingSyncOperations(db, userId)
    expect(pending).toHaveLength(1)
    expect(pending[0].lastError).toContain('network down')

    await removeSyncOperation(db, pending[0].id)
    expect(await listPendingSyncOperations(db, userId)).toHaveLength(0)

    db.close()
  })
})
