import { createContext, useContext } from 'react'
import type { Me } from '../api/me'

export type Auth = { me: Me; signOut: () => Promise<void> }

export const AuthContext = createContext<Auth | null>(null)

/** AuthGate 안에서만 쓴다 */
export function useAuth(): Auth {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('AuthGate 밖에서 useAuth를 썼어요')
  return auth
}
