import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { UNAUTHORIZED_EVENT } from '../api/client'
import { getMe, logout, type Me } from '../api/me'
import LoginPage from '../pages/LoginPage'
import { AuthContext } from './useAuth'

type State = { status: 'loading' } | { status: 'out'; error?: string } | { status: 'in'; me: Me }

/** 로그인했으면 앱을, 아니면 로그인 화면을 보여준다(docs/design.md 11-6 2-1) */
export default function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' })

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
  if (state.status === 'out') return <LoginPage />
  return <AuthContext.Provider value={{ me: state.me, signOut }}>{children}</AuthContext.Provider>
}
