import { useEffect } from 'react'
import AppShell from '../components/AppShell'
import { restoreSession } from '../features/auth/authService'
import { AppProviders } from './providers'
import { AppRoutes } from './router'
import '../styles/tokens.css'
import '../styles/globals.css'

export default function App() {
  useEffect(() => {
    void restoreSession()
  }, [])

  return (
    <AppProviders>
      <AppShell>
        <AppRoutes />
      </AppShell>
    </AppProviders>
  )
}
