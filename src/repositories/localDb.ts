import Dexie, { type Table } from 'dexie'
import type { ReviewLog, StudySession, UserWord } from '../types/domain'

export type SyncOperation = {
  id: string
  userId: string
  kind: 'upsert-word' | 'append-review-log' | 'upsert-session'
  payload: unknown
  createdAt: number
  lastError?: string
}

export type QueryCacheRecord = {
  normalizedQuery: string
  payload: unknown
  createdAt: number
  expiresAt: number
}

export class LocalVocabDatabase extends Dexie {
  userWords!: Table<UserWord, [string, string]>
  reviewLogs!: Table<ReviewLog, string>
  studySessions!: Table<StudySession, string>
  syncOperations!: Table<SyncOperation, string>
  queryCache!: Table<QueryCacheRecord, string>

  constructor(name = 'kaoyan-core-vocab') {
    super(name)
    this.version(1).stores({
      userWords: '&[userId+normalizedTerm], &[userId+id], userId, normalizedTerm, nextReviewAt',
      reviewLogs: '&id, userId, normalizedTerm, reviewedAt, [userId+reviewedAt]',
      studySessions: '&id, userId, startedAt',
      syncOperations: '&id, userId, createdAt',
      queryCache: '&normalizedQuery, expiresAt'
    })
  }
}

export function createLocalDb(name?: string) {
  return new LocalVocabDatabase(name)
}
