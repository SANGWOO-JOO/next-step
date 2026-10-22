import { NavLink, Outlet } from 'react-router-dom'

const MENUS = [
  { to: '/', label: '오늘', end: true },
  { to: '/weekly', label: '주간' },
  { to: '/monthly', label: '월간' },
  { to: '/goals', label: '최종 목표' },
  { to: '/dashboard', label: '시간 대시보드' },
  { to: '/checklist', label: '체크리스트' },
  { to: '/settings', label: '설정' },
]

export default function Layout() {
  return (
    <div className="app">
      <header className="app-header">
        <span className="brand">Job Scheduler</span>
        <nav className="nav">
          {MENUS.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              end={m.end}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {m.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
