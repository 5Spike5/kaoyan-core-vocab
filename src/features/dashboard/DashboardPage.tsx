import { ArrowRight, BookOpen, ClipboardList } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function DashboardPage() {
  return (
    <section className="page dashboard-page" aria-labelledby="dashboard-title">
      <div className="page-heading">
        <p className="eyebrow">TODAY'S STUDY</p>
        <h1 id="dashboard-title">今天，先攻下 24 个词</h1>
        <p className="lede">保留原来的四选一复习入口，后续会接入 FSRS 到期词、新词学习和错词复盘。</p>
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
          <button type="button" className="button button-primary">
            开始今日复习
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="action-panel">
          <div className="panel-icon" aria-hidden="true">
            <ClipboardList size={22} />
          </div>
          <div>
            <h2>新词学习</h2>
            <p>从核心词表中学习未掌握词，后续会同步到个人生词库。</p>
          </div>
          <button type="button" className="button button-secondary">
            开始新词学习
          </button>
        </div>
      </div>

      <div className="quiet-band">
        <span>想先查一个词？</span>
        <Link to="/lookup">去查词</Link>
      </div>
    </section>
  )
}
