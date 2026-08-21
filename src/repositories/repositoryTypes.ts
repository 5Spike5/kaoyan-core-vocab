import type { ReviewLog, StudySession, UserWord } from '../types/domain'

export interface WordRepository {
  listUserWords(userId: string): Promise<UserWord[]>
  getUserWord(userId: string, normalizedTerm: string): Promise<UserWord | null>
  upsertUserWord(word: UserWord): Promise<UserWord>
  deleteUserWord(userId: string, wordId: string): Promise<void>
}

export interface ReviewRepository {
  appendReviewLog(log: ReviewLog): Promise<void>
  listReviewLogs(userId: string): Promise<ReviewLog[]>
}

export interface StudySessionRepository {
  upsertStudySession(session: StudySession): Promise<StudySession>
  listStudySessions(userId: string): Promise<StudySession[]>
}

export interface LocalRepository extends WordRepository, ReviewRepository, StudySessionRepository {
  close(): Promise<void>
}
