import { Navigate, Route, Routes } from 'react-router-dom'
import AuthPage from '../features/auth/AuthPage'
import DashboardPage from '../features/dashboard/DashboardPage'
import LookupPage from '../features/lookup/LookupPage'
import ReviewPage from '../features/review/ReviewPage'
import SettingsPage from '../features/settings/SettingsPage'
import StatsPage from '../features/stats/StatsPage'
import VocabListPage from '../features/vocab/VocabListPage'

export function AppRoutes() {
  return (
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
  )
}
