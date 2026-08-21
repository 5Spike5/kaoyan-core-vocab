import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Download,
  Library,
  ListChecks,
  RefreshCcw,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { publicVocab } from "../../data/publicVocab";
import { createLocalRepository } from "../../repositories/localRepository";
import type { ReviewLog, StudySession, UserWord } from "../../types/domain";
import { getCurrentUser, subscribeToAuth } from "../auth/authService";
import {
  calculateTodayStudyMinutes,
  countLearnedWords,
  countWordsByStatus,
} from "../stats/statsSelectors";
import { selectDashboardStats } from "./dashboardSelectors";

const LOCAL_USER_ID = "local";
const GOAL_KEY = "kaoyan-daily-goal";
const GOAL_OPTIONS = [60, 80, 100, 120];

type StudyMode = "today" | "due" | "free";

const STUDY_MODES: Array<{
  value: StudyMode;
  label: string;
  desc: string;
  icon: typeof BookOpen;
}> = [
  { value: "today", label: "今日背诵", desc: "每日新词", icon: BookOpen },
  { value: "due", label: "强制复习", desc: "到期复习", icon: RefreshCcw },
  { value: "free", label: "自主复习", desc: "自选练习", icon: ListChecks },
];

const MODE_CTA: Record<StudyMode, string> = {
  today: "开始今日学习",
  due: "开始强制复习",
  free: "开始自主复习",
};

function loadGoal(): number {
  const saved = Number(localStorage.getItem(GOAL_KEY));
  return GOAL_OPTIONS.includes(saved) ? saved : 80;
}

function startOfToday(now = Date.now()) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getCurrentUser());
  const [goal, setGoal] = useState(loadGoal);
  const [mode, setMode] = useState<StudyMode>("today");
  const [data, setData] = useState<{
    words: UserWord[];
    logs: ReviewLog[];
    sessions: StudySession[];
  } | null>(null);

  useEffect(() => subscribeToAuth(() => setUser(getCurrentUser())), []);

  const load = useCallback(async () => {
    const repository = createLocalRepository();
    try {
      const [words, logs, sessions] = await Promise.all([
        repository.listUserWords(LOCAL_USER_ID),
        repository.listReviewLogs(LOCAL_USER_ID),
        repository.listStudySessions(LOCAL_USER_ID),
      ]);
      return { words, logs, sessions };
    } finally {
      await repository.close();
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void load().then((result) => {
      if (!cancelled) {
        setData(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const words = data?.words ?? [];
  const logs = data?.logs ?? [];
  const sessions = data?.sessions ?? [];

  const stats = selectDashboardStats(words, logs);
  const statusCounts = countWordsByStatus(words);
  const learned = countLearnedWords(words);
  const totalVocab = publicVocab.length;

  const todayStart = startOfToday();
  const todayDone = logs.filter((log) => log.reviewedAt >= todayStart).length;
  const goalPercent = Math.min(100, Math.round((todayDone / goal) * 100));
  const progressPercent =
    totalVocab === 0 ? 0 : Math.round((learned / totalVocab) * 100);

  const todayMinutes = calculateTodayStudyMinutes(logs, sessions);
  const totalMinutes = Math.round(
    logs.reduce((total, log) => total + log.elapsedMs, 0) / 60000,
  );

  const handleGoal = (value: number) => {
    setGoal(value);
    localStorage.setItem(GOAL_KEY, String(value));
  };

  const startMode =
    STUDY_MODES.find((item) => item.value === mode) ?? STUDY_MODES[0];

  return (
    <section className="page dashboard-page" aria-labelledby="dashboard-title">
      <div className="page-heading">
        <p className="eyebrow">TODAY'S STUDY</p>
        <h1 id="dashboard-title">今天，继续保持学习节奏</h1>
        <p className="lede">
          先攻下 {stats.newCount} 个新词，再复习 {stats.dueCount} 个到期词。
        </p>
      </div>

      <div className="profile-card" aria-label="个人资料">
        <div className="profile-avatar" aria-hidden="true">
          {(user?.email?.[0] ?? "本").toUpperCase()}
        </div>
        <div className="profile-info">
          <div className="profile-name">{user?.email ?? "本地学习者"}</div>
          <div className="profile-meta">
            {user ? "云同步模式" : "本地模式 · 数据保存在本机"}
          </div>
        </div>
        <div className="profile-extra">
          <span>
            已学 <b>{learned.toLocaleString()}</b> 词
          </span>
          <span>
            连续 <b>{stats.streakDays}</b> 天
          </span>
        </div>
      </div>

      <div className="goal-card" aria-label="今日学习目标">
        <div className="goal-head">
          <span className="goal-title">今日学习目标</span>
          <span className="goal-value">
            {todayDone} / {goal} 词
          </span>
        </div>
        <p className="goal-subtitle">完成目标后记得休息一下</p>
        <div className="goal-bar" aria-hidden="true">
          <div className="goal-bar-fill" style={{ width: `${goalPercent}%` }} />
        </div>
        <div className="goal-btns" role="group" aria-label="每日目标">
          {GOAL_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={`goal-btn ${goal === option ? "active" : ""}`}
              aria-pressed={goal === option}
              onClick={() => handleGoal(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="study-modes" role="group" aria-label="学习模式">
        {STUDY_MODES.map((item) => {
          const Icon = item.icon;
          const active = mode === item.value;
          return (
            <button
              key={item.value}
              type="button"
              className={`study-mode ${active ? "active" : ""}`}
              aria-pressed={active}
              onClick={() => setMode(item.value)}
            >
              <Icon
                size={24}
                strokeWidth={2}
                className="study-mode-icon"
                aria-hidden="true"
              />
              <span className="study-mode-title">{item.label}</span>
              <span className="study-mode-desc">{item.desc}</span>
            </button>
          );
        })}
      </div>

      <div className="stats-row" aria-label="今日概览">
        <div className="stat-item">
          <div className="stat-num">{stats.newCount}</div>
          <div className="stat-label">待学</div>
        </div>
        <div className="stat-item">
          <div className="stat-num">{stats.dueCount}</div>
          <div className="stat-label">待复习</div>
        </div>
        <div className="stat-item">
          <div className="stat-num success">{statusCounts.mastered}</div>
          <div className="stat-label">已掌握</div>
        </div>
        <div className="stat-item">
          <div className="stat-num muted">{totalVocab.toLocaleString()}</div>
          <div className="stat-label">词库</div>
        </div>
      </div>

      <button
        type="button"
        className="home-cta"
        onClick={() => navigate(`/review?mode=${mode}`)}
      >
        {MODE_CTA[mode]}
        <ArrowRight size={20} aria-hidden="true" />
      </button>

      <div className="progress-card" aria-label="学习进度">
        <div className="card-header">
          <span className="card-title">学习进度</span>
          <span className="card-value">
            {learned.toLocaleString()} / {totalVocab.toLocaleString()}
          </span>
        </div>
        <div className="progress-bar" aria-hidden="true">
          <div
            className="progress-bar-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="progress-detail">
          <span>
            已学 <b>{learned.toLocaleString()}</b>
          </span>
          <span>
            掌握 <b>{statusCounts.mastered.toLocaleString()}</b>
          </span>
          <span>
            已斩 <b>{statusCounts.suspended.toLocaleString()}</b>
          </span>
          <span>
            待学 <b>{statusCounts.new.toLocaleString()}</b>
          </span>
        </div>
      </div>

      <div className="time-card" aria-label="学习时长">
        <div className="card-header">
          <span className="card-title">学习时长</span>
          {startMode ? (
            <span className="card-value">{startMode.label}</span>
          ) : null}
        </div>
        <div className="time-row">
          <div className="time-item">
            <div className="time-num">
              {todayMinutes} <span className="time-unit">分钟</span>
            </div>
            <div className="time-label">今日</div>
          </div>
          <div className="time-item">
            <div className="time-num">
              {totalMinutes} <span className="time-unit">分钟</span>
            </div>
            <div className="time-label">累计</div>
          </div>
        </div>
      </div>

      <div className="home-section">
        <p className="home-section-title">词库管理</p>
        <div className="data-grid">
          <Link to="/vocab" className="data-btn">
            <Upload size={15} aria-hidden="true" />
            导入词汇
          </Link>
          <Link to="/vocab" className="data-btn">
            <Library size={15} aria-hidden="true" />
            单词表
          </Link>
          <Link to="/settings" className="data-btn">
            <Download size={15} aria-hidden="true" />
            数据导出
          </Link>
          <Link to="/stats" className="data-btn">
            <BarChart3 size={15} aria-hidden="true" />
            学习统计
          </Link>
        </div>
      </div>
    </section>
  );
}
