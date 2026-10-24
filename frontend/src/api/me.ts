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
  /** AI 주간 피드백 동의(docs/design.md 9-1) */
  aiAgreed: boolean
  /** 앱 안 알림 설정(docs/design.md 10장 1-5) */
  notifications: NotificationSettings
}

/** 블록 시작, 오늘 요약, 한 주 마무리, 하루 마무리와 그 시각(20~23시) */
export type NotificationSettings = { block: boolean; today: boolean; weekly: boolean; shutdown: boolean; shutdownHour: number }

export type OnboardingInput = {
  /** 이용약관·개인정보 수집·이용 동의(2-4) */
  agreed: boolean
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
export const skipOnboarding = (agreed: boolean) => api.post<Me>('/api/me/onboarding/skip', { agreed })

/** 설정의 "준비 중인 것" 바꾸기(2-6) */
export const changePurpose = (purpose: Purpose) => api.patch<Me>('/api/me/purpose', { purpose })

/** 앱 안 알림 설정 바꾸기(1-5) */
export const changeNotifications = (settings: NotificationSettings) => api.patch<Me>('/api/me/notifications', settings)

/** AI 주간 피드백 동의 켜기와 끄기(9-1) */
export const agreeAi = () => api.post<Me>('/api/me/ai-consent')
export const withdrawAi = () => api.delete<Me>('/api/me/ai-consent')

/** 회원 탈퇴(2-4). 모든 기록과 계정을 지우고 세션을 끝낸다 */
export const withdraw = () => api.delete<void>('/api/me')
