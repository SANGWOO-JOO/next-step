import { api } from './client'
import type { CategoryRef } from './goals'

/** GOAL·STUDY는 공부, DISTRACTION은 딴짓, OTHER는 밥·산책 같은 일정 */
export type ActualKind = 'GOAL' | 'STUDY' | 'DISTRACTION' | 'OTHER'

export const ACTUAL_KIND_LABELS: Record<ActualKind, string> = {
  GOAL: '하루 목표',
  STUDY: '공부',
  DISTRACTION: '딴짓',
  OTHER: '기타',
}

export type ActualLog = {
  id: number
  date: string
  startAt: string
  endAt: string
  kind: ActualKind
  dailyGoalId: number | null
  category: CategoryRef | null
  title: string | null
  label: string
  timeBlockId: number | null
}

export type ActualLogInput = {
  date: string
  startAt: string
  endAt: string
  kind: ActualKind
  dailyGoalId: number | null
  categoryId: number | null
  title: string | null
}

export const getActualLogsBetween = (from: string, to: string) =>
  api.get<ActualLog[]>(`/api/actual-logs?from=${from}&to=${to}`)

/** 만들고 나면 그날 기록 전체(잘리고 합쳐진 결과)가 온다 */
export const createActualLog = (input: ActualLogInput) => api.post<ActualLog[]>('/api/actual-logs', input)

export const updateActualLog = (id: number, input: ActualLogInput) => api.put<ActualLog[]>(`/api/actual-logs/${id}`, input)

export const deleteActualLog = (id: number) => api.delete<void>(`/api/actual-logs/${id}`)

/** [계획대로]: 계획 블록을 실제 기록으로 */
export const actualFromBlock = (blockId: number) => api.post<ActualLog[]>(`/api/actual-logs/from-block/${blockId}`)

export const getDistractionTitles = (q = '') =>
  api.get<string[]>(`/api/actual-logs/distraction-titles${q ? `?q=${encodeURIComponent(q)}` : ''}`)

export type UnrecordedBlock = {
  blockId: number
  label: string
  dailyGoalId: number | null
  startAt: string
  endAt: string
}

/** 그날 계획 vs 실제(docs/design.md 1-4e) */
export type PlanComparison = {
  plannedMinutes: number
  /** 지금까지 지나간 계획 분. 계획대로 %의 분모 */
  plannedSoFarMinutes: number
  asPlannedMinutes: number
  asPlannedPercent: number | null
  actualStudyMinutes: number
  actualDistractionMinutes: number
  actualOtherMinutes: number
  /** 지나갔는데 실제 기록이 없는 계획 블록 */
  unrecordedBlocks: UnrecordedBlock[]
}

export const getPlanComparison = (date: string) => api.get<PlanComparison>(`/api/actual-logs/compare?date=${date}`)
