import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { UNAUTHORIZED_EVENT } from '../api/client'
import { getMe, logout, type Me } from '../api/me'
import { Route, Routes, useLocation } from 'react-router-dom'
import LandingPage from '../pages/LandingPage'
import LegalPage from '../pages/LegalPage'
import WelcomePage from '../pages/WelcomePage'
import { AuthContext } from './useAuth'

type State = { status: 'loading' } | { status: 'out'; error?: string } | { status: 'in'; me: Me }

/** 로그인했으면 앱을(시작 설정 전이면 시작 설정을), 아니면 로그인 화면을 보여준다(docs/design.md 11-6 2-1·2-3) */
export default function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const { pathname } = useLocation()

  useEffect(() => {
    getMe()
      .then((me) => setState({ status: 'in', me }))
      .catch(() => setState({ status: 'out' }))
    const expired = () => setState({ status: 'out' })
    window.addEventListener(UNAUTHORIZED_EVENT, expired)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, expired)
  }, [])

  const signOut = useCallback(async () => {
    try {
      await logout()
    } finally {
      setState({ status: 'out' })
    }
  }, [])

  if (state.status === 'loading') return null
  // 로그인 안 했으면 랜딩. 약관·개인정보는 누구나 본다(2-4 ①)
  if (state.status === 'out')
    return (
      <Routes>
        <Route path="/terms" element={<LegalPage kind="terms" />} />
        <Route path="/privacy" element={<LegalPage kind="privacy" />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    )
  // 시작 설정을 마치지 않았으면 먼저(docs/design.md 11-2). 중간에 닫으면 다음에 처음부터
  // 시작 설정 중에 연 약관·개인정보 링크(새 탭)도 볼 수 있게
  if (!state.me.onboarded && (pathname === '/terms' || pathname === '/privacy'))
    return <LegalPage kind={pathname === '/terms' ? 'terms' : 'privacy'} />
  if (!state.me.onboarded) return <WelcomePage me={state.me} onDone={(me) => setState({ status: 'in', me })} />
  return <AuthContext.Provider value={{ me: state.me, signOut }}>{children}</AuthContext.Provider>
}
