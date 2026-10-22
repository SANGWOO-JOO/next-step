import { api } from './client'
import type { CategoryRef } from './goals'

export type ManualStudyLog = { id: number; date: string; category: CategoryRef; minutes: number; memo: string | null }

export type ManualStudyLogInput = { date: string; categoryId: number; minutes: number; memo: string | null }

export type DailySummary = {
  focusSeconds: number
  distractionSeconds: number
  sessionCount: number
  manualMinutes: number
  goalsDone: number
  goalsTotal: number
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

export const CONDITION_LABELS: Record<number, string> = { 1: '😫', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' }

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
