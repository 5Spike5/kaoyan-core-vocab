import AppShell from '../components/AppShell'
import { AppProviders } from './providers'
import { AppRoutes } from './router'
import '../styles/tokens.css'
import '../styles/globals.css'

export default function App() {
  return (
    <AppProviders>
      <AppShell>
        <AppRoutes />
      </AppShell>
    </AppProviders>
  )
}
