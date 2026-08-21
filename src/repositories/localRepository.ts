import { createLocalDb, type LocalVocabDatabase } from './localDb'
import type { LocalRepository } from './repositoryTypes'
import type { ReviewLog, StudySession, UserWord } from '../types/domain'

export type LocalRepositoryOptions = {
  name?: string
  db?: LocalVocabDatabase
}

export function createLocalRepository(options: LocalRepositoryOptions = {}): LocalRepository {
  const db = options.db ?? createLocalDb(options.name)

  return {
    async listUserWords(userId: string) {
      return db.userWords.where('userId').equals(userId).sortBy('updatedAt')
    },

    async getUserWord(userId: string, normalizedTerm: string) {
      return (await db.userWords.get([userId, normalizedTerm])) ?? null
    },

    async upsertUserWord(word: UserWord) {
      const existing = await db.userWords.get([word.userId, word.normalizedTerm])
      const next: UserWord = existing
        ? {
            ...word,
            id: existing.id,
            createdAt: existing.createdAt
          }
        : word

      await db.userWords.put(next)
      return next
    },

    async deleteUserWord(userId: string, wordId: string) {
      const existing = await db.userWords.where('[userId+id]').equals([userId, wordId]).first()

      if (existing) {
        await db.userWords.delete([existing.userId, existing.normalizedTerm])
      }
    },

    async appendReviewLog(log: ReviewLog) {
      await db.reviewLogs.put(log)
    },

    async listReviewLogs(userId: string) {
      return db.reviewLogs.where('userId').equals(userId).sortBy('reviewedAt')
    },

    async upsertStudySession(session: StudySession) {
      await db.studySessions.put(session)
      return session
    },

    async listStudySessions(userId: string) {
      return db.studySessions.where('userId').equals(userId).sortBy('startedAt')
    },

    async close() {
      db.close()
    }
  }
}
