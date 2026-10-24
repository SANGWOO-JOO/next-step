import { createContext, useContext } from 'react'
import type { Me } from '../api/me'

/** setMe: 설정에서 바꾼 내 정보를 앱 전체에 반영 */
export type Auth = { me: Me; signOut: () => Promise<void>; setMe: (me: Me) => void }

export const AuthContext = createContext<Auth | null>(null)

/** AuthGate 안에서만 쓴다 */
export function useAuth(): Auth {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('AuthGate 밖에서 useAuth를 썼어요')
  return auth
}
