import { createNewCard } from '../lib/fsrs'
import { normalizeTerm } from '../lib/normalizeTerm'
import { createUserWordFromLookup } from '../features/vocab/vocabService'
import type { LocalRepository } from '../repositories/repositoryTypes'
import type { FsrsSnapshot, StudySession, UserWord } from '../types/domain'
import type { LegacyStorageSnapshot } from './legacyStorage'

export type MigrationReport = {
  importedWords: number
  importedLogs: number
  importedSessions: number
  skippedRecords: number
  errors: string[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return null
}

function isFsrsSnapshot(value: unknown): value is FsrsSnapshot {
  const record = asRecord(value)
  return (
    record !== null &&
    typeof record.due === 'string' &&
    typeof record.stability === 'number' &&
    typeof record.difficulty === 'number' &&
    typeof record.reps === 'number'
  )
}

function wordFromLegacyValue(value: unknown, userId: string): UserWord | null {
  const record = asRecord(value)
  if (!record) {
    return null
  }

  const term = readString(record, ['word', 'term', 'text'])
  if (!term) {
    return null
  }

  const meaning = readString(record, ['meaning', 'definition', 'translation']) ?? ''
  const word = createUserWordFromLookup({ term, meaning })
  const fsrsCandidate = record.fsrs ?? record.fsrsCard ?? record.card

  return {
    ...word,
    id: typeof record.id === 'string' ? record.id : word.id,
    userId,
    normalizedTerm: normalizeTerm(term),
    fsrs: isFsrsSnapshot(fsrsCandidate) ? fsrsCandidate : createNewCard(),
    createdAt: typeof record.createdAt === 'number' ? record.createdAt : word.createdAt,
    updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : word.updatedAt
  }
}

function sessionFromLegacyValue(value: unknown, userId: string, index: number): StudySession | null {
  const record = asRecord(value)
  if (!record) {
    return null
  }

  return {
    id: typeof record.id === 'string' ? record.id : `legacy-session-${index + 1}`,
    userId,
    mode: 'due',
    wordIds: Array.isArray(record.wordIds) ? record.wordIds.filter((item) => typeof item === 'string') : [],
    currentIndex: typeof record.currentIndex === 'number' ? record.currentIndex : 0,
    startedAt: typeof record.startedAt === 'number' ? record.startedAt : Date.now(),
    completedAt: typeof record.completedAt === 'number' ? record.completedAt : null
  }
}

export async function migrateLegacyData(
  snapshot: LegacyStorageSnapshot,
  repository: LocalRepository,
  userId: string
): Promise<MigrationReport> {
  const report: MigrationReport = {
    importedWords: 0,
    importedLogs: 0,
    importedSessions: 0,
    skippedRecords: 0,
    errors: []
  }

  for (const item of snapshot.customVocab) {
    const word = wordFromLegacyValue(item, userId)
    if (!word) {
      report.skippedRecords += 1
      continue
    }

    try {
      await repository.upsertUserWord(word)
      report.importedWords += 1
    } catch (error) {
      report.errors.push(error instanceof Error ? error.message : String(error))
    }
  }

  for (const record of snapshot.progressRecords) {
    const word = wordFromLegacyValue(record.value, userId)
    if (!word) {
      report.skippedRecords += 1
      continue
    }

    try {
      await repository.upsertUserWord(word)
      report.importedWords += 1
    } catch (error) {
      report.errors.push(error instanceof Error ? error.message : String(error))
    }
  }

  for (const [index, record] of snapshot.sessions.entries()) {
    const session = sessionFromLegacyValue(record.value, userId, index)
    if (!session) {
      report.skippedRecords += 1
      continue
    }

    try {
      await repository.upsertStudySession(session)
      report.importedSessions += 1
    } catch (error) {
      report.errors.push(error instanceof Error ? error.message : String(error))
    }
  }

  return report
}
