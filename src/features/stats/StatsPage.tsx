import { useCallback, useEffect, useMemo, useState } from 'react'
import { Skeleton } from '../../components/Skeleton'
import { createLocalRepository } from '../../repositories/localRepository'
import type { ReviewLog, StudySession, UserWord } from '../../types/domain'
import {
  calculateAccuracy,
  calculateTodayStudyMinutes,
  countDueWords,
  countLearnedWords,
  countWordsByStatus,
  dailyAccuracy,
  recentActivity
} from './statsSelectors'

const LOCAL_USER_ID = 'local'
const DAY_MS = 24 * 60 * 60 * 1000
const HEATMAP_WEEKS = 53
const ACCURACY_DAYS = 14

type StatsData = {
  words: UserWord[]
  logs: ReviewLog[]
  sessions: StudySession[]
}

type HeatCell = {
  date: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
  isToday: boolean
}

/** GitHub 风格热力图：列为周（周日→周六），最后一列包含今天。 */
function buildHeatmap(
  countByDate: Map<string, number>,
  weeks = HEATMAP_WEEKS,
  now = Date.now(),
): HeatCell[][] {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  // 最后一列的周六（今天所在周的周六），未来格子不渲染
  const endOfWeek = today.getTime() + (6 - today.getDay()) * DAY_MS
  const start = endOfWeek - (weeks * 7 - 1) * DAY_MS

  const columns: HeatCell[][] = []
  for (let week = 0; week < weeks; week += 1) {
    const column: HeatCell[] = []
    for (let day = 0; day < 7; day += 1) {
      const timestamp = start + (week * 7 + day) * DAY_MS
      if (timestamp > today.getTime()) {
        continue
      }
      const date = new Date(timestamp)
      const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
      const count = countByDate.get(key) ?? 0
      const level: HeatCell['level'] =
        count === 0 ? 0 : count < 10 ? 1 : count < 20 ? 2 : count < 40 ? 3 : 4
      column.push({ date: key, count, level, isToday: timestamp === today.getTime() })
    }
    columns.push(column)
  }
  return columns
}

/** 正确率趋势折线图（SVG 坐标按 400×120 viewBox 计算）。 */
function AccuracyChart({
  points,
}: {
  points: Array<{ date: string; accuracy: number; total: number }>
}) {
  const left = 30
  const right = 392
  const top = 10
  const bottom = 102
  const x = (index: number) =>
    points.length === 1
      ? (left + right) / 2
      : left + (index * (right - left)) / (points.length - 1)
  const y = (accuracy: number) => top + ((100 - accuracy) * (bottom - top)) / 100

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${y(point.accuracy)}`)
    .join(' ')
  const areaPath = `${linePath} L${x(points.length - 1)},${bottom} L${x(0)},${bottom} Z`
  const gridLines = [100, 50, 0]

  return (
    <svg
      className="accuracy-chart"
      viewBox="0 0 400 120"
      role="img"
      aria-label="最近 14 天正确率趋势"
    >
      {gridLines.map((value) => (
        <g key={value}>
          <line x1={left} x2={right} y1={y(value)} y2={y(value)} />
          <text
            className="accuracy-label"
            x={left - 6}
            y={y(value) + 3}
            textAnchor="end"
          >
            {value}
          </text>
        </g>
      ))}
      <path className="accuracy-area" d={areaPath} />
      <path className="accuracy-line" d={linePath} />
      {points.map((point, index) => (
        <circle
          key={point.date}
          className="accuracy-point"
          cx={x(index)}
          cy={y(point.accuracy)}
          r={3}
        >
          <title>{`${point.date}：正确率 ${point.accuracy}%（${point.total} 题）`}</title>
        </circle>
      ))}
      <text className="accuracy-label" x={left} y={116}>
        {points[0]?.date.slice(5)}
      </text>
      <text className="accuracy-label" x={right} y={116} textAnchor="end">
        {points[points.length - 1]?.date.slice(5)}
      </text>
    </svg>
  )
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

  const heatmapWeeks = useMemo(() => {
    if (!data) {
      return []
    }
    const countByDate = new Map(
      recentActivity(data.logs, HEATMAP_WEEKS * 7).map((day) => [day.date, day.count]),
    )
    return buildHeatmap(countByDate)
  }, [data])

  const accuracyTrend = useMemo(
    () => (data ? dailyAccuracy(data.logs, ACCURACY_DAYS) : []),
    [data],
  )

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
      <section className="page stats-page" aria-busy="true">
        <Skeleton className="skeleton-heading" />
        <Skeleton className="skeleton-block" />
        <Skeleton className="skeleton-block short" />
      </section>
    )
  }

  const todayMinutes = calculateTodayStudyMinutes(data.logs, data.sessions)
  const learned = countLearnedWords(data.words)
  const accuracy = calculateAccuracy(data.logs)
  const due = countDueWords(data.words)
  const statusCounts = countWordsByStatus(data.words)

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

        <section className="lookup-block" aria-label="正确率趋势">
          <h3>最近 {ACCURACY_DAYS} 天正确率</h3>
          {accuracyTrend.length >= 2 ? (
            <AccuracyChart points={accuracyTrend} />
          ) : (
            <p className="page-note">最近两周还没有作答记录，做完一组复习就能看到趋势。</p>
          )}
        </section>
      </div>

      <section className="lookup-block" aria-label="学习热力图">
        <h3>学习热力图（近一年）</h3>
        <div className="heatmap">
          {heatmapWeeks.map((week, index) => (
            <div className="heatmap-week" key={index}>
              {week.map((cell) => (
                <span
                  key={cell.date}
                  className={`heatmap-cell ${cell.level > 0 ? `l${cell.level}` : ''} ${
                    cell.isToday ? 'today' : ''
                  }`}
                  title={`${cell.date}：${cell.count} 次复习`}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="heatmap-legend" aria-hidden="true">
          少
          <span className="heatmap-cell" />
          <span className="heatmap-cell l1" />
          <span className="heatmap-cell l2" />
          <span className="heatmap-cell l3" />
          <span className="heatmap-cell l4" />
          多
        </div>
      </section>
    </section>
  )
}
