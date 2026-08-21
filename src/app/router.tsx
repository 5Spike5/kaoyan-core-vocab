import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardPage from '../features/dashboard/DashboardPage'
import LookupPage from '../features/lookup/LookupPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/lookup" element={<LookupPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
