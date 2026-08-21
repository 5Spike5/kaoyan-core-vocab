import { publicVocab } from '../data/publicVocab'
import type { UserWord, UserWordStatus } from '../types/domain'
import { normalizeTerm } from './normalizeTerm'

/**
 * 旧版（单文件 index.html）导出的学习进度备份解析。
 * 备份格式：{ dailyGoal, words: { "term": { status, fsrs, nextReview, ... } }, stats, _customVocab }
 */

type LegacyBackupWord = {
  status?: string
  level?: number
  stability?: number
  difficulty?: number
  nextReview?: number | null
  lastReview?: number | null
  lastStudy?: number
  firstLearned?: number
  correct?: number
  wrong?: number
  fsrs?: {
    due?: number | string
    stability?: number
    difficulty?: number
    elapsed_days?: number
    scheduled_days?: number
    reps?: number
    lapses?: number
    state?: number
    step?: number | null
    last_review?: number | null
  } | null
  fsrsState?: string
}

export type LegacyBackupData = {
  dailyGoal?: number
  words?: Record<string, LegacyBackupWord>
  stats?: Record<string, unknown>
  _user?: string
  _exportDate?: string
  _customVocab?: Array<{ word?: string; meaning?: string }>
}

export type LegacyBackupParseResult = {
  words: UserWord[]
  dailyGoal: number | null
}

const STATUS_MAP: Record<string, UserWordStatus> = {
  new: 'new',
  learning: 'learning',
  review: 'reviewing',
  reviewing: 'reviewing',
  mastered: 'mastered',
  ignored: 'suspended'
}

function toFsrsCard(word: LegacyBackupWord): UserWord['fsrs'] {
  const fsrs = word.fsrs
  if (!fsrs) {
    return undefined
  }
  return {
    due: new Date((fsrs.due ?? word.nextReview ?? Date.now()) as number | string).toISOString(),
    stability: fsrs.stability ?? word.stability ?? 0,
    difficulty: fsrs.difficulty ?? word.difficulty ?? 0,
    elapsed_days: fsrs.elapsed_days ?? 0,
    scheduled_days: fsrs.scheduled_days ?? 0,
    learning_steps: fsrs.step ?? 0,
    reps: fsrs.reps ?? 0,
    lapses: Math.max(0, fsrs.lapses ?? 0),
    state: fsrs.state ?? 0,
    last_review: fsrs.last_review ? new Date(fsrs.last_review).toISOString() : undefined
  }
}

/** 解析旧版备份 JSON，转换为新版 UserWord 列表。 */
export function parseLegacyBackup(json: string): LegacyBackupParseResult {
  let data: LegacyBackupData
  try {
    data = JSON.parse(json) as LegacyBackupData
  } catch {
    throw new Error('无法解析文件，请确认是旧版导出的 JSON 备份')
  }

  if (!data || typeof data !== 'object' || typeof data.words !== 'object' || data.words === null) {
    throw new Error('不是有效的备份文件：缺少 words 字段')
  }

  const now = Date.now()
  const words: UserWord[] = []

  for (const [term, word] of Object.entries(data.words)) {
    if (!word || typeof word !== 'object') {
      continue
    }
    const normalizedTerm = normalizeTerm(term)
    const entry = publicVocab.find((item) => item.normalizedTerm === normalizedTerm)
    const statusKey = (word.status ?? '').toLowerCase()

    words.push({
      id: `legacy-${normalizedTerm}`,
      userId: 'local',
      term,
      normalizedTerm,
      meanings: entry?.meanings ?? [],
      status: STATUS_MAP[statusKey] ?? 'new',
      tags: [],
      fsrs: toFsrsCard(word),
      nextReviewAt:
        typeof word.nextReview === 'number'
          ? word.nextReview
          : typeof word.fsrs?.due === 'number'
            ? word.fsrs.due
            : null,
      createdAt: word.firstLearned ?? now,
      updatedAt: word.lastStudy ?? now
    })
  }

  // 旧版自定义词（通常为空，防御性解析）
  for (const item of data._customVocab ?? []) {
    if (!item.word) {
      continue
    }
    const normalizedTerm = normalizeTerm(item.word)
    if (words.some((word) => word.normalizedTerm === normalizedTerm)) {
      continue
    }
    words.push({
      id: `legacy-${normalizedTerm}`,
      userId: 'local',
      term: item.word,
      normalizedTerm,
      meanings: item.meaning ? [{ text: item.meaning, source: 'user' }] : [],
      status: 'new',
      tags: [],
      fsrs: undefined,
      nextReviewAt: null,
      createdAt: now,
      updatedAt: now
    })
  }

  return {
    words,
    dailyGoal: typeof data.dailyGoal === 'number' ? data.dailyGoal : null
  }
}
