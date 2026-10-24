import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import logoDark from '../assets/brand/logo-horizontal-dark.svg'
import logoLight from '../assets/brand/logo-horizontal-light.svg'
import { useAuth } from '../auth/useAuth'
import NavIcon from './NavIcon'
import ReminderStack from './ReminderStack'

type Menu = { to: string; label: string; icon: string; end?: boolean }

/** 메뉴 구성(docs/design.md 6장 "메뉴"): 매일 쓰는 것 위, 설정은 맨 아래 */
const GROUPS: { title: string; menus: Menu[] }[] = [
  {
    title: '매일',
    menus: [
      { to: '/', label: '일정', icon: 'schedule', end: true },
      { to: '/goals', label: '목표', icon: 'plan' },
      { to: '/log', label: '기록', icon: 'log' },
    ],
  },
  {
    title: '돌아보기·준비',
    menus: [
      { to: '/dashboard', label: '대시보드', icon: 'dashboard' },
    ],
  },
]
const SETTINGS: Menu = { to: '/settings', label: '설정', icon: 'settings' }
const ALL = [...GROUPS.flatMap((g) => g.menus), SETTINGS]

const COLLAPSED_KEY = 'layout.sidebar.collapsed'
/** 다른 화면에서 메뉴를 접게 할 때 보내는 이벤트(일정 화면의 넓게 보기 안내) */
export const COLLAPSE_EVENT = 'layout:collapse-sidebar'


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
  const location = useLocation()
  const { me, signOut } = useAuth()
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  // 바깥을 누르거나 Esc면 프로필 메뉴를 닫는다
  useEffect(() => {
    if (!profileOpen) return
    const onDown = (e: MouseEvent) => !profileRef.current?.contains(e.target as Node) && setProfileOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setProfileOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [profileOpen])

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

  useEffect(() => {
    const collapse = () => {
      setCollapsed(true)
      try {
        localStorage.setItem(COLLAPSED_KEY, '1')
      } catch {
        // 저장 못 해도 지금은 접는다
      }
    }
    window.addEventListener(COLLAPSE_EVENT, collapse)
    return () => window.removeEventListener(COLLAPSE_EVENT, collapse)
  }, [])

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
    </NavLink>
  )

  return (
    <div className={collapsed ? 'app collapsed' : 'app'}>
      <header className="mobile-bar">
        <button className="icon" onClick={() => setDrawerOpen(true)} aria-label="메뉴 열기">
          <NavIcon name="menu" />
        </button>
        <strong>{current?.label ?? 'Next Step'}</strong>
      </header>
      {drawerOpen && <div className="drawer-scrim" onClick={() => setDrawerOpen(false)} />}

      <aside className={drawerOpen ? 'sidebar open' : 'sidebar'} aria-label="메뉴">
        {/* CI 가로 로고(docs/brand). 다크 모드는 흰 글자, 라이트 모드는 검은 글자. 접으면 심볼만 */}
        <div className="side-brand" aria-label="Next Step">
          {collapsed ? (
            <NavIcon name="brand" />
          ) : (
            <picture>
              <source srcSet={logoDark} media="(prefers-color-scheme: dark)" />
              <img className="brand-logo" src={logoLight} alt="Next Step" height={28} draggable={false} />
            </picture>
          )}
        </div>
        <nav className="side-nav">
          {GROUPS.map((g) => (
            <div key={g.title} className="side-group">
              {g.menus.map(link)}
            </div>
          ))}
        </nav>
        <div className="side-foot">
          {/* 프로필 메뉴(docs/design.md 11-2, 프로토타입 Profile): 누르면 위로 이름·이메일, 설정, 로그아웃 */}
          <div className="side-profile" ref={profileRef}>
            {profileOpen && (
              <div className="side-profile-menu" role="menu">
                <div className="side-profile-head">
                  <strong>{me.name ?? me.email}</strong>
                  <span className="muted small">{me.email}</span>
                </div>
                <NavLink to="/settings" role="menuitem" className="side-profile-item" onClick={() => setProfileOpen(false)}>
                  <NavIcon name="settings" />
                  설정
                </NavLink>
                <button type="button" role="menuitem" className="side-profile-item" onClick={signOut}>
                  <NavIcon name="logout" />
                  로그아웃
                </button>
              </div>
            )}
            <button
              type="button"
              className={profileOpen ? 'side-link side-user open' : 'side-link side-user'}
              onClick={() => setProfileOpen(!profileOpen)}
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              title={collapsed ? (me.name ?? me.email) : undefined}
            >
              {me.pictureUrl ? (
                <img className="side-avatar" src={me.pictureUrl} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span className="side-avatar">{(me.name ?? me.email).slice(0, 1)}</span>
              )}
              <span className="side-label side-user-name">{me.name ?? me.email}</span>
            </button>
          </div>
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

      {/* 모든 페이지가 같은 여백에서 시작한다(docs/design.md 6장 화면 폭) */}
      <main className="app-main">
        <Outlet />
      </main>
      <ReminderStack />
    </div>
  )
}
