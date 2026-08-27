import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardPage from '../features/dashboard/DashboardPage'
import ReviewPage from '../features/review/ReviewPage'

// 首页与学习页随首屏加载；其余页面按需分包，减小首屏 JS 体积
const AuthPage = lazy(() => import('../features/auth/AuthPage'))
const LookupPage = lazy(() => import('../features/lookup/LookupPage'))
const SettingsPage = lazy(() => import('../features/settings/SettingsPage'))
const StatsPage = lazy(() => import('../features/stats/StatsPage'))
const VocabListPage = lazy(() => import('../features/vocab/VocabListPage'))

export function AppRoutes() {
  return (
    <Suspense
      fallback={
        <section className="page">
          <p className="page-note">加载中…</p>
        </section>
      }
    >
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/lookup" element={<LookupPage />} />
        <Route path="/vocab" element={<VocabListPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
