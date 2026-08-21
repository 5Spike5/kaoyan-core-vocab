import type { LocalVocabDatabase, SyncOperation } from './localDb'
import type { ReviewLog, StudySession, UserWord } from '../types/domain'

export type SyncRemote = {
  upsertWord(word: UserWord): Promise<void>
  appendReviewLog(log: ReviewLog): Promise<void>
  upsertSession(session: StudySession): Promise<void>
}

export type SyncFlushResult = {
  succeeded: number
  failed: number
}

export function mergeUserWord<T extends { updatedAt: number }>(local: T, remote: T): T {
  return local.updatedAt >= remote.updatedAt ? local : remote
}

export function mergeReviewLogs<T extends { id: string }>(local: T[], remote: T[]): T[] {
  return [...new Map([...remote, ...local].map((item) => [item.id, item])).values()]
}

export function mergeStudySessions<T extends { id: string; updatedAt?: number }>(local: T[], remote: T[]): T[] {
  const merged = new Map<string, T>()
  for (const item of [...remote, ...local]) {
    const existing = merged.get(item.id)
    if (!existing || (item.updatedAt ?? 0) >= (existing.updatedAt ?? 0)) {
      merged.set(item.id, item)
    }
  }
  return [...merged.values()]
}

function createOperationId() {
  return globalThis.crypto?.randomUUID?.() ?? `sync-${Date.now()}-${Math.random()}`
}

export async function enqueueSyncOperation(
  db: LocalVocabDatabase,
  input: { userId: string; kind: SyncOperation['kind']; payload: unknown }
): Promise<SyncOperation> {
  const operation: SyncOperation = {
    id: createOperationId(),
    userId: input.userId,
    kind: input.kind,
    payload: input.payload,
    createdAt: Date.now()
  }
  await db.syncOperations.put(operation)
  return operation
}

export async function listPendingSyncOperations(db: LocalVocabDatabase, userId: string): Promise<SyncOperation[]> {
  return db.syncOperations.where('userId').equals(userId).sortBy('createdAt')
}

export async function removeSyncOperation(db: LocalVocabDatabase, operationId: string): Promise<void> {
  await db.syncOperations.delete(operationId)
}

export async function flushSyncQueue(
  db: LocalVocabDatabase,
  userId: string,
  remote: SyncRemote
): Promise<SyncFlushResult> {
  const pending = await listPendingSyncOperations(db, userId)
  const result: SyncFlushResult = { succeeded: 0, failed: 0 }

  for (const operation of pending) {
    try {
      switch (operation.kind) {
        case 'upsert-word':
          await remote.upsertWord(operation.payload as UserWord)
          break
        case 'append-review-log':
          await remote.appendReviewLog(operation.payload as ReviewLog)
          break
        case 'upsert-session':
          await remote.upsertSession(operation.payload as StudySession)
          break
      }
      await removeSyncOperation(db, operation.id)
      result.succeeded += 1
    } catch (error) {
      result.failed += 1
      await db.syncOperations.update(operation.id, {
        lastError: error instanceof Error ? error.message : String(error)
      })
    }
  }

  return result
}
