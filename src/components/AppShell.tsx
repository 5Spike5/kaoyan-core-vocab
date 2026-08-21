import { BookOpenCheck, Library, Search } from 'lucide-react'
import type { PropsWithChildren } from 'react'
import { NavLink } from 'react-router-dom'
import SyncStatus from './SyncStatus'

const navItems = [
  { to: '/', label: '今日学习', icon: BookOpenCheck, end: true },
  { to: '/lookup', label: '查词', icon: Search, end: false },
  { to: '/vocab', label: '生词库', icon: Library, end: false }
]

export default function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="应用侧边栏">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            研
          </div>
          <div>
            <strong>研词 Core</strong>
            <span>考研英语词汇系统</span>
          </div>
        </div>

        <nav className="primary-nav" aria-label="主导航">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink key={item.to} to={item.to} end={item.end} className="nav-link">
                <Icon aria-hidden="true" size={18} strokeWidth={2.1} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <SyncStatus />
      </aside>

      <main className="app-main">{children}</main>
    </div>
  )
}
