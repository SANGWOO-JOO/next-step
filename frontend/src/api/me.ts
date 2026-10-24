import { api } from './client'

export type Me = {
  id: number
  email: string
  name: string | null
  pictureUrl: string | null
  onboarded: boolean
}

export const getMe = () => api.get<Me>('/api/me')

/** 서버 세션을 끝낸다(SecurityConfig의 /logout, 204) */
export const logout = () => api.post<void>('/logout')

/** 구글 로그인 시작 주소. Vite가 /oauth2를 백엔드로 넘긴다 */
export const GOOGLE_LOGIN_URL = '/oauth2/authorization/google'
