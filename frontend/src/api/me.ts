import { api } from './client'
import type { GoalInput } from './goals'

/** 시작 설정 1단계의 목적(docs/design.md 11-1) */
export type Purpose = 'JOB_SEEKER' | 'CAREER_CHANGER'

export type Me = {
  id: number
  email: string
  name: string | null
  pictureUrl: string | null
  onboarded: boolean
  purpose: Purpose | null
}

export type OnboardingInput = {
  purpose: Purpose
  goal: GoalInput
  /** 칠한 칸(이어진 칸은 합쳐서). 서울 오프셋 ISO */
  blocks: { startAt: string; endAt: string }[]
}

export const getMe = () => api.get<Me>('/api/me')

/** 서버 세션을 끝낸다(SecurityConfig의 /logout, 204) */
export const logout = () => api.post<void>('/logout')

/** 구글 로그인 시작 주소. Vite가 /oauth2를 백엔드로 넘긴다 */
export const GOOGLE_LOGIN_URL = '/oauth2/authorization/google'

/** 시작 설정 마치기(2-3). 목적·첫 목표·이번 주 블록을 한 번에 저장한다 */
export const completeOnboarding = (input: OnboardingInput) => api.post<Me>('/api/me/onboarding', input)

/** 이미 쓰던 사람은 건너뛴다 */
export const skipOnboarding = () => api.post<Me>('/api/me/onboarding/skip')
