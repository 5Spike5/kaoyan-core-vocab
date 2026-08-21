import { ArrowRight, BookOpen, ClipboardList } from 'lucide-react'
import { Link } from 'react-router-dom'
import { selectDashboardStats } from './dashboardSelectors'

export default function DashboardPage() {
  const stats = selectDashboardStats([], [])

  return (
    <section className="page dashboard-page" aria-labelledby="dashboard-title">
      <div className="page-heading">
        <p className="eyebrow">TODAY'S STUDY</p>
        <h1 id="dashboard-title">今天，先攻下 24 个词</h1>
        <p className="lede">保留原来的四选一复习入口，后续会接入 FSRS 到期词、新词学习和错词复盘。</p>
      </div>

      <div className="metric-grid" aria-label="学习概览">
        <div>
          <span>{stats.dueCount}</span>
          <p>到期复习</p>
        </div>
        <div>
          <span>{stats.newCount}</span>
          <p>新词</p>
        </div>
        <div>
          <span>{stats.accuracy}%</span>
          <p>正确率</p>
        </div>
        <div>
          <span>{stats.streakDays}</span>
          <p>连续天数</p>
        </div>
      </div>

      <div className="action-grid" aria-label="学习入口">
        <div className="action-panel primary-action">
          <div className="panel-icon" aria-hidden="true">
            <BookOpen size={22} />
          </div>
          <div>
            <h2>到期复习</h2>
            <p>按记忆状态安排今日任务，答案仍然使用四个选项。</p>
          </div>
          <Link to="/review" className="button button-primary" role="button">
            开始今日复习
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>

        <div className="action-panel">
          <div className="panel-icon" aria-hidden="true">
            <ClipboardList size={22} />
          </div>
          <div>
            <h2>新词学习</h2>
            <p>从核心词表中学习未掌握词，后续会同步到个人生词库。</p>
          </div>
          <Link to="/review" className="button button-secondary" role="button">
            开始新词学习
          </Link>
        </div>
      </div>

      <div className="quiet-band">
        <span>想先查一个词？</span>
        <Link to="/lookup">查词</Link>
      </div>
    </section>
  )
}
