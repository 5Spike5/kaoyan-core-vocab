import type { ReviewLog, StudySession, UserWord } from "../../types/domain";

export function calculateAccuracy(logs: ReviewLog[]): number {
  if (logs.length === 0) {
    return 0;
  }
  return Math.round(
    (logs.filter((log) => log.answeredCorrectly).length / logs.length) * 100,
  );
}

export function countDueWords(words: UserWord[], now = Date.now()): number {
  return words.filter(
    (word) => word.nextReviewAt !== null && word.nextReviewAt <= now,
  ).length;
}

export function countLearnedWords(words: UserWord[]): number {
  return words.filter((word) => word.status !== "new").length;
}

export function countWordsByStatus(words: UserWord[]) {
  return {
    new: words.filter((word) => word.status === "new").length,
    learning: words.filter((word) => word.status === "learning").length,
    reviewing: words.filter((word) => word.status === "reviewing").length,
    mastered: words.filter((word) => word.status === "mastered").length,
    suspended: words.filter((word) => word.status === "suspended").length,
  };
}

function startOfToday(now = Date.now()) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function calculateTodayStudyMinutes(
  logs: ReviewLog[],
  sessions: StudySession[],
  now = Date.now(),
): number {
  const dayStart = startOfToday(now);
  const todayLogs = logs.filter((log) => log.reviewedAt >= dayStart);
  const todaySessions = sessions.filter(
    (session) =>
      session.completedAt !== null && session.completedAt >= dayStart,
  );

  const logMinutes =
    todayLogs.reduce((total, log) => total + log.elapsedMs, 0) / 60000;
  const sessionMinutes = todaySessions.reduce((total, session) => {
    if (session.completedAt === null) {
      return total;
    }
    return total + (session.completedAt - session.startedAt) / 60000;
  }, 0);

  return Math.round(logMinutes + sessionMinutes);
}

/** 最近 7 天每天的复习次数（按天聚合，用于活动列表）。 */
export function recentActivity(
  logs: ReviewLog[],
  days = 7,
  now = Date.now(),
): Array<{ date: string; count: number }> {
  const dayStart = startOfToday(now);
  const buckets = new Map<string, number>();

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(dayStart - offset * 24 * 60 * 60 * 1000);
    buckets.set(date.toISOString().slice(0, 10), 0);
  }

  for (const log of logs) {
    const key = new Date(log.reviewedAt).toISOString().slice(0, 10);
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }

  return [...buckets.entries()].map(([date, count]) => ({ date, count }));
}
