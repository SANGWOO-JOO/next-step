import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { getCurrentFocus } from '../api/focus'
import NavIcon from './NavIcon'

type Menu = { to: string; label: string; icon: string; end?: boolean }

/** 메뉴 구성(docs/design.md 6장 "메뉴"): 매일 쓰는 것 위, 설정은 맨 아래 */
const GROUPS: { title: string; menus: Menu[] }[] = [
  {
    title: '매일',
    menus: [
      { to: '/', label: '일정', icon: 'schedule', end: true },
      { to: '/focus', label: '집중', icon: 'focus' },
      { to: '/plan', label: '계획', icon: 'plan' },
      { to: '/log', label: '기록', icon: 'log' },
    ],
  },
  {
    title: '돌아보기·준비',
    menus: [
      { to: '/dashboard', label: '대시보드', icon: 'dashboard' },
      { to: '/checklist', label: '체크리스트', icon: 'checklist' },
    ],
  },
]
const SETTINGS: Menu = { to: '/settings', label: '설정', icon: 'settings' }
const ALL = [...GROUPS.flatMap((g) => g.menus), SETTINGS]

const COLLAPSED_KEY = 'layout.sidebar.collapsed'

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

/** 왼쪽 세로 메뉴 + 접기. 좁은 화면에서는 위쪽 ☰로 여는 서랍 */
export default function Layout() {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [focusing, setFocusing] = useState(false)
  const location = useLocation()

  // 집중 세션 진행 여부: 화면을 옮길 때와 1분마다 확인한다
  useEffect(() => {
    const check = () =>
      getCurrentFocus()
        .then((s) => setFocusing(!!s))
        .catch(() => setFocusing(false))
    check()
    const timer = window.setInterval(check, 60_000)
    return () => window.clearInterval(timer)
  }, [location.pathname])

  // 화면을 옮기면 서랍은 닫는다
  useEffect(() => setDrawerOpen(false), [location.pathname, location.search])

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0')
    } catch {
      // 저장 못 해도 지금은 바뀐다
    }
  }

  const current = ALL.find((m) => (m.end ? location.pathname === m.to : location.pathname.startsWith(m.to)))

  const link = (m: Menu) => (
    <NavLink
      key={m.to}
      to={m.to}
      end={m.end}
      title={collapsed ? m.label : undefined}
      aria-label={m.label}
      className={({ isActive }) => (isActive ? 'side-link active' : 'side-link')}
    >
      <NavIcon name={m.icon} />
      <span className="side-label">{m.label}</span>
      {m.to === '/focus' && focusing && (
        <>
          <span className="side-badge">진행 중</span>
          <span className="side-dot" aria-hidden="true" />
        </>
      )}
    </NavLink>
  )

  return (
    <div className={collapsed ? 'app collapsed' : 'app'}>
      <header className="mobile-bar">
        <button className="icon" onClick={() => setDrawerOpen(true)} aria-label="메뉴 열기">
          <NavIcon name="menu" />
        </button>
        <strong>{current?.label ?? 'Job Scheduler'}</strong>
      </header>
      {drawerOpen && <div className="drawer-scrim" onClick={() => setDrawerOpen(false)} />}

      <aside className={drawerOpen ? 'sidebar open' : 'sidebar'} aria-label="메뉴">
        <div className="side-brand">
          <NavIcon name="schedule" />
          <span className="side-label">Job Scheduler</span>
        </div>
        <nav className="side-nav">
          {GROUPS.map((g) => (
            <div key={g.title} className="side-group">
              <span className="side-group-title">{g.title}</span>
              {g.menus.map(link)}
            </div>
          ))}
        </nav>
        <div className="side-foot">
          {link(SETTINGS)}
          <button
            type="button"
            className="side-link side-toggle"
            onClick={toggle}
            title={collapsed ? '메뉴 펼치기' : undefined}
            aria-label={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
          >
            <NavIcon name={collapsed ? 'expand' : 'collapse'} />
            <span className="side-label">메뉴 접기</span>
          </button>
        </div>
      </aside>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
