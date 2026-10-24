import type { PlanComparison } from './actualLogs'
import { api } from './client'
import type { CategoryRef } from './goals'

export type ManualStudyLog = { id: number; date: string; category: CategoryRef; minutes: number; memo: string | null }

export type ManualStudyLogInput = { date: string; categoryId: number; minutes: number; memo: string | null }

export type DailySummary = {
  /** 실제 기록(없으면 지난 집중 세션) + 수동 기록 */
  studySeconds: number
  focusSeconds: number
  distractionSeconds: number
  sessionCount: number
  manualMinutes: number
  goalsDone: number
  goalsTotal: number
  /** 계획 vs 실제(1-4e) */
  plan: PlanComparison
}

export type DailyLog = {
  date: string
  /** 그날 완료한 하루 목표 */
  doneGoals: string[]
  /** 아직 저장하지 않았으면 false */
  saved: boolean
  memo: string | null
  condition: number | null
  updatedAt: string | null
  summary: DailySummary
}


/** 컨디션 이름(docs/design.md 11-6 2-9 ⑦). 그림은 ConditionFace */
export const CONDITION_NAMES: Record<number, string> = { 1: '지침', 2: '별로', 3: '보통', 4: '좋음', 5: '최고' }

export const getManualLogs = (date: string) => api.get<ManualStudyLog[]>(`/api/manual-logs?date=${date}`)

export const createManualLog = (input: ManualStudyLogInput) => api.post<ManualStudyLog>('/api/manual-logs', input)

export const updateManualLog = (id: number, input: ManualStudyLogInput) =>
  api.put<ManualStudyLog>(`/api/manual-logs/${id}`, input)

export const deleteManualLog = (id: number) => api.delete<void>(`/api/manual-logs/${id}`)

export const getDailyLog = (date: string) => api.get<DailyLog>(`/api/daily-logs/${date}`)

export const saveDailyLog = (date: string, input: { memo: string | null; condition: number | null }) =>
  api.put<DailyLog>(`/api/daily-logs/${date}`, input)

/** 기록 페이지: 기록이나 공부가 있는 날(최신순, 최대 62일) */
export const getDailyLogs = (from: string, to: string) => api.get<DailyLog[]>(`/api/daily-logs?from=${from}&to=${to}`)
