import { api } from './client'
import type { CategoryRef } from './goals'

export type DailyGoalType = 'CORE' | 'EXTRA'
export type DailyGoalStatus = 'TODO' | 'DONE'

export const MAX_CORE = 3

export type DailyGoal = {
  id: number
  weeklyGoalId: number
  weeklyGoalContent: string
  date: string
  content: string
  firstAction: string | null
  category: CategoryRef | null
  type: DailyGoalType
  sortOrder: number
  status: DailyGoalStatus
  carryCount: number
}

export type DailyGoalCreateInput = {
  weeklyGoalId: number
  date: string
  content: string
  firstAction: string | null
  /** null이면 주간 목표의 분류를 물려받는다 */
  categoryId: number | null
  /** null이면 핵심 자리가 있을 때 CORE, 아니면 EXTRA */
  type: DailyGoalType | null
}

export type DailyGoalUpdateInput = {
  content: string
  firstAction: string | null
  categoryId: number | null
  status: DailyGoalStatus
}

export type DailyGoalMoveResult = { dailyGoal: DailyGoal; downgradedToExtra: boolean }

export const toDailyGoalUpdateInput = (d: DailyGoal): DailyGoalUpdateInput => ({
  content: d.content,
  firstAction: d.firstAction,
  categoryId: d.category?.id ?? null,
  status: d.status,
})

export const getDailyGoals = (date: string) => api.get<DailyGoal[]>(`/api/daily-goals?date=${date}`)

export const getDailyGoalsBetween = (from: string, to: string) =>
  api.get<DailyGoal[]>(`/api/daily-goals?from=${from}&to=${to}`)

export const getUnfinishedDailyGoals = (before: string) =>
  api.get<DailyGoal[]>(`/api/daily-goals/unfinished?before=${before}`)

export const createDailyGoal = (input: DailyGoalCreateInput) => api.post<DailyGoal>('/api/daily-goals', input)

export const updateDailyGoal = (id: number, input: DailyGoalUpdateInput) =>
  api.put<DailyGoal>(`/api/daily-goals/${id}`, input)

export const deleteDailyGoal = (id: number) => api.delete<void>(`/api/daily-goals/${id}`)

export const moveDailyGoal = (id: number, date: string, weeklyGoalId: number | null = null) =>
  api.post<DailyGoalMoveResult>(`/api/daily-goals/${id}/move`, { date, weeklyGoalId })

export const changeDailyGoalType = (id: number, type: DailyGoalType) =>
  api.patch<DailyGoal>(`/api/daily-goals/${id}/type`, { type })

export const reorderDailyGoals = (date: string, type: DailyGoalType, ids: number[]) =>
  api.put<DailyGoal[]>('/api/daily-goals/order', { date, type, ids })
