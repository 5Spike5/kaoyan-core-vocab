import {
  BarChart3,
  BookOpenCheck,
  Library,
  Search,
  Settings,
} from "lucide-react";
import type { PropsWithChildren } from "react";
import { NavLink } from "react-router-dom";
import SyncStatus from "./SyncStatus";
import ToastHost from "./Toast";

const navItems = [
  { to: "/", label: "今日学习", icon: BookOpenCheck, end: true },
  { to: "/lookup", label: "查词", icon: Search, end: false },
  { to: "/vocab", label: "生词库", icon: Library, end: false },
  { to: "/stats", label: "统计", icon: BarChart3, end: false },
  { to: "/settings", label: "设置", icon: Settings, end: false },
];

function NavItems() {
  return navItems.map((item) => {
    const Icon = item.icon;
    return (
      <NavLink key={item.to} to={item.to} end={item.end} className="nav-link">
        <Icon aria-hidden="true" size={18} strokeWidth={2.1} />
        <span>{item.label}</span>
      </NavLink>
    );
  });
}

export default function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <header className="topbar">
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
          <NavItems />
        </nav>

        <SyncStatus />
      </header>

      <main className="app-main">{children}</main>

      <nav className="bottom-nav" aria-label="移动端导航">
        <NavItems />
      </nav>

      <ToastHost />
    </div>
  );
}
