import { api } from './client'
import type { DailyGoalStatus } from './dailyGoals'
import type { CategoryRef } from './goals'

export type FocusResult = 'COMPLETED' | 'MORE' | 'DISTRACTED'
export type FocusSource = 'TODAY' | 'FOCUS_PAGE' | 'TELEGRAM'
export type InterruptionType = 'DISTRACTION' | 'STUDY_MATERIAL' | 'BREAK'
export type InterruptionDetection = 'TAB_HIDDEN' | 'BUTTON'

export const INTERRUPTION_LABELS: Record<InterruptionType, string> = {
  DISTRACTION: '딴짓',
  STUDY_MATERIAL: '공부 자료 찾기',
  BREAK: '휴식',
}

export const RESULT_LABELS: Record<FocusResult, string> = {
  COMPLETED: '완료',
  MORE: '더 하기',
  DISTRACTED: '딴짓했어요',
}

export type Interruption = {
  id: number
  startedAt: string
  endedAt: string | null
  type: InterruptionType | null
  detection: InterruptionDetection
  memo: string | null
}

export type DistractionNote = {
  id: number
  sessionId: number
  sessionDate: string
  dailyGoalContent: string | null
  content: string
  checked: boolean
  createdAt: string
}

export type FocusSession = {
  id: number
  dailyGoal: { id: number; content: string; firstAction: string | null; status: DailyGoalStatus } | null
  category: CategoryRef | null
  date: string
  startedAt: string
  endedAt: string | null
  focusMinutes: number
  breakMinutes: number
  /** 실제 집중 시간(초). 진행 중이면 응답 시각까지 */
  focusSeconds: number
  pausedSeconds: number
  result: FocusResult | null
  completed: boolean
  source: FocusSource
  running: boolean
  interruptions: Interruption[]
  notes: DistractionNote[]
}

export type FocusStartInput = {
  dailyGoalId: number | null
  categoryId: number | null
  focusMinutes: number
  breakMinutes: number
  source: FocusSource
}

export const DEFAULT_FOCUS_MINUTES = 25
export const DEFAULT_BREAK_MINUTES = 5

/** 진행 중 세션. 없으면 undefined(204) */
export const getCurrentFocus = () => api.get<FocusSession | undefined>('/api/focus-sessions/current')

export const getFocusSessions = (date: string) => api.get<FocusSession[]>(`/api/focus-sessions?date=${date}`)

export const startFocus = (input: FocusStartInput) => api.post<FocusSession>('/api/focus-sessions', input)

export const endFocus = (id: number, result: FocusResult) =>
  api.post<FocusSession>(`/api/focus-sessions/${id}/end`, { result })

export const changeFocusCategory = (id: number, categoryId: number | null) =>
  api.patch<FocusSession>(`/api/focus-sessions/${id}/category`, { categoryId })

export const startInterruption = (id: number, detection: InterruptionDetection, startedAt?: string) =>
  api.post<FocusSession>(`/api/focus-sessions/${id}/interruptions`, { detection, startedAt })

export const endInterruption = (
  id: number,
  interruptionId: number,
  input: { type: InterruptionType; memo: string | null; endedAt?: string },
) => api.post<FocusSession>(`/api/focus-sessions/${id}/interruptions/${interruptionId}/end`, input)

export const addDistractionNote = (sessionId: number, content: string) =>
  api.post<DistractionNote>(`/api/focus-sessions/${sessionId}/notes`, { content })

export const getDistractionNotes = (checked?: boolean) =>
  api.get<DistractionNote[]>(`/api/distraction-notes${checked === undefined ? '' : `?checked=${checked}`}`)

export const checkDistractionNote = (id: number, checked: boolean) =>
  api.patch<DistractionNote>(`/api/distraction-notes/${id}`, { checked })

/** 열린 중단 */
export const openInterruptionOf = (s: FocusSession) => s.interruptions.find((i) => i.endedAt === null) ?? null

/** 초 → 'MM:SS' (1시간 이상이면 'H:MM:SS') */
export function formatClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** 초 → '1시간 5분' / '12분' / '40초' */
export function formatDuration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  // 1분 미만은 의미가 없어 "–"로 보여준다(1-4f, "딴짓 1초" 같은 표시 없앰)
  if (s < 60) return '–'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}시간${m > 0 ? ` ${m}분` : ''}` : `${m}분`
}
