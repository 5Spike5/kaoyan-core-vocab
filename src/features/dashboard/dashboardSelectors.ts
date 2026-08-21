import type { ReviewLog, UserWord } from '../../types/domain'

export type DashboardStats = {
  dueCount: number
  newCount: number
  accuracy: number
  streakDays: number
}

export function selectDashboardStats(
  words: UserWord[],
  logs: ReviewLog[],
  now = Date.now()
): DashboardStats {
  const dueCount = words.filter((word) => word.nextReviewAt !== null && word.nextReviewAt <= now).length
  const newCount = words.filter((word) => word.status === 'new').length
  const scoredLogs = logs.filter((log) => log.rating !== undefined)
  const accuracy =
    scoredLogs.length === 0
      ? 0
      : Math.round((scoredLogs.filter((log) => log.answeredCorrectly).length / scoredLogs.length) * 100)

  return {
    dueCount,
    newCount,
    accuracy,
    streakDays: logs.length > 0 ? 1 : 0
  }
}
