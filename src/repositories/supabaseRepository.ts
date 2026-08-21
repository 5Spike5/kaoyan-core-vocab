import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReviewLog, StudySession, UserWord } from '../types/domain'
import type { SyncRemote } from './syncService'

export type UserWordRow = {
  id: string
  user_id: string
  term: string
  normalized_term: string
  source_vocab_key: string | null
  part_of_speech: string | null
  meanings: unknown
  notes: string | null
  tags: unknown
  status: string
  fsrs_card: unknown
  next_review_at: string | null
  created_at: string
  updated_at: string
}

export type ReviewLogRow = {
  id: string
  user_id: string
  user_word_id: string
  normalized_term: string
  rating: number
  answered_correctly: boolean
  elapsed_ms: number
  reviewed_at: string
}

export type StudySessionRow = {
  id: string
  user_id: string
  mode: string
  word_ids: unknown
  current_index: number
  started_at: string
  completed_at: string | null
}

export interface CloudRepository extends SyncRemote {
  listUserWords(userId: string): Promise<UserWord[]>
  getUserWord(userId: string, normalizedTerm: string): Promise<UserWord | null>
  deleteUserWord(userId: string, wordId: string): Promise<void>
  listReviewLogs(userId: string): Promise<ReviewLog[]>
  listStudySessions(userId: string): Promise<StudySession[]>
}

function toUserWord(row: UserWordRow): UserWord {
  const fsrsCard = row.fsrs_card as UserWord['fsrs'] | null
  const meanings = (row.meanings ?? []) as UserWord['meanings']
  const tags = (row.tags ?? []) as string[]

  return {
    id: row.id,
    userId: row.user_id,
    term: row.term,
    normalizedTerm: row.normalized_term,
    meanings,
    status: row.status as UserWord['status'],
    sourceVocabKey: row.source_vocab_key ?? undefined,
    notes: row.notes ?? undefined,
    tags,
    fsrs: fsrsCard ?? undefined,
    nextReviewAt: row.next_review_at ? new Date(row.next_review_at).getTime() : null,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime()
  }
}

function toWordRow(userId: string, word: UserWord): UserWordRow {
  return {
    id: word.id,
    user_id: userId,
    term: word.term,
    normalized_term: word.normalizedTerm,
    source_vocab_key: word.sourceVocabKey ?? null,
    part_of_speech: null,
    meanings: word.meanings,
    notes: word.notes ?? null,
    tags: word.tags,
    status: word.status,
    fsrs_card: word.fsrs ?? null,
    next_review_at: word.nextReviewAt ? new Date(word.nextReviewAt).toISOString() : null,
    created_at: new Date(word.createdAt).toISOString(),
    updated_at: new Date(word.updatedAt).toISOString()
  }
}

export function createSupabaseRepository(client: SupabaseClient): CloudRepository {
  return {
    async upsertWord(word: UserWord) {
      const row = toWordRow(word.userId, word)
      const { error } = await client.from('user_words').upsert(row, {
        onConflict: 'user_id,normalized_term'
      })
      if (error) {
        throw error
      }
    },

    async appendReviewLog(log: ReviewLog) {
      const { error } = await client.from('review_logs').insert({
        id: log.id,
        user_id: log.userId,
        user_word_id: log.wordId,
        normalized_term: log.normalizedTerm,
        rating: log.rating,
        answered_correctly: log.answeredCorrectly,
        elapsed_ms: log.elapsedMs,
        reviewed_at: new Date(log.reviewedAt).toISOString()
      })
      if (error) {
        throw error
      }
    },

    async upsertSession(session: StudySession) {
      const { error } = await client.from('study_sessions').upsert(
        {
          id: session.id,
          user_id: session.userId,
          mode: session.mode,
          word_ids: session.wordIds,
          current_index: session.currentIndex,
          started_at: new Date(session.startedAt).toISOString(),
          completed_at: session.completedAt ? new Date(session.completedAt).toISOString() : null
        },
        { onConflict: 'id' }
      )
      if (error) {
        throw error
      }
    },

    async listUserWords(userId: string) {
      const { data, error } = await client
        .from('user_words')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: true })

      if (error) {
        throw error
      }
      return (data ?? []).map((row) => toUserWord(row as UserWordRow))
    },

    async getUserWord(userId: string, normalizedTerm: string) {
      const { data, error } = await client
        .from('user_words')
        .select('*')
        .eq('user_id', userId)
        .eq('normalized_term', normalizedTerm)
        .maybeSingle()

      if (error) {
        throw error
      }
      return data ? toUserWord(data as UserWordRow) : null
    },

    async deleteUserWord(userId: string, wordId: string) {
      const { error } = await client.from('user_words').delete().eq('user_id', userId).eq('id', wordId)
      if (error) {
        throw error
      }
    },

    async listReviewLogs(userId: string) {
      const { data, error } = await client
        .from('review_logs')
        .select('*')
        .eq('user_id', userId)
        .order('reviewed_at', { ascending: true })

      if (error) {
        throw error
      }
      return (data ?? []).map((row) => {
        const item = row as ReviewLogRow
        return {
          id: item.id,
          userId: item.user_id,
          wordId: item.user_word_id,
          normalizedTerm: item.normalized_term,
          rating: item.rating as ReviewLog['rating'],
          answeredCorrectly: item.answered_correctly,
          reviewedAt: new Date(item.reviewed_at).getTime(),
          elapsedMs: item.elapsed_ms
        }
      })
    },

    async listStudySessions(userId: string) {
      const { data, error } = await client
        .from('study_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: true })

      if (error) {
        throw error
      }
      return (data ?? []).map((row) => {
        const item = row as StudySessionRow
        return {
          id: item.id,
          userId: item.user_id,
          mode: item.mode as StudySession['mode'],
          wordIds: (item.word_ids ?? []) as string[],
          currentIndex: item.current_index,
          startedAt: new Date(item.started_at).getTime(),
          completedAt: item.completed_at ? new Date(item.completed_at).getTime() : null
        }
      })
    }
  }
}
