import { useCallback, useEffect, useState } from 'react'
import { createLocalRepository } from '../../repositories/localRepository'
import type { ReviewLog, StudySession, UserWord } from '../../types/domain'
import {
  calculateAccuracy,
  calculateTodayStudyMinutes,
  countDueWords,
  countLearnedWords,
  countWordsByStatus,
  recentActivity
} from './statsSelectors'

const LOCAL_USER_ID = 'local'

type StatsData = {
  words: UserWord[]
  logs: ReviewLog[]
  sessions: StudySession[]
}

export default function StatsPage() {
  const [data, setData] = useState<StatsData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const repository = createLocalRepository()
    try {
      const [words, logs, sessions] = await Promise.all([
        repository.listUserWords(LOCAL_USER_ID),
        repository.listReviewLogs(LOCAL_USER_ID),
        repository.listStudySessions(LOCAL_USER_ID)
      ])
      setData({ words, logs, sessions })
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '统计数据加载失败')
    } finally {
      await repository.close()
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (error) {
    return (
      <section className="page stats-page" aria-labelledby="stats-title">
        <p className="page-note page-note-error" role="alert">
          {error}
        </p>
      </section>
    )
  }

  if (!data) {
    return (
      <section className="page stats-page" aria-labelledby="stats-title">
        <p className="page-note">正在加载统计…</p>
      </section>
    )
  }

  const todayMinutes = calculateTodayStudyMinutes(data.logs, data.sessions)
  const learned = countLearnedWords(data.words)
  const accuracy = calculateAccuracy(data.logs)
  const due = countDueWords(data.words)
  const statusCounts = countWordsByStatus(data.words)
  const activity = recentActivity(data.logs)

  return (
    <section className="page stats-page" aria-labelledby="stats-title">
      <div className="page-heading">
        <p className="eyebrow">STATS</p>
        <h1 id="stats-title">学习统计</h1>
        <p className="lede">从本地复习记录汇总今日与整体学习情况。</p>
      </div>

      <div className="metric-grid" aria-label="核心指标">
        <div>
          <span>{todayMinutes}</span>
          <p>今日学习（分钟）</p>
        </div>
        <div>
          <span>{learned}</span>
          <p>已学单词</p>
        </div>
        <div>
          <span>{accuracy}%</span>
          <p>正确率</p>
        </div>
        <div>
          <span>{due}</span>
          <p>待复习</p>
        </div>
      </div>

      <div className="stats-grid">
        <section className="lookup-block" aria-label="词库状态">
          <h3>词库状态</h3>
          <div className="corpus-stats">
            <div>
              <strong>{statusCounts.new}</strong>
              <span>新词</span>
            </div>
            <div>
              <strong>{statusCounts.learning}</strong>
              <span>学习中</span>
            </div>
            <div>
              <strong>{statusCounts.reviewing}</strong>
              <span>复习中</span>
            </div>
            <div>
              <strong>{statusCounts.mastered}</strong>
              <span>已掌握</span>
            </div>
          </div>
        </section>

        <section className="lookup-block" aria-label="最近活动">
          <h3>最近 7 天复习次数</h3>
          <div className="activity-bars" aria-label="每日复习次数">
            {activity.map((day) => (
              <div key={day.date} className="activity-bar" title={`${day.date}：${day.count} 次`}>
                <span className="activity-bar-fill" style={{ height: `${Math.min(100, day.count * 14)}%` }} />
                <span className="activity-bar-label">{day.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}
