import { api } from './client'

/** 진행·완료·멈춤·그만둠(docs/design.md 11-4) */
export type GoalStatus = 'ACTIVE' | 'DONE' | 'PAUSED' | 'DROPPED'

export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  ACTIVE: '진행 중',
  DONE: '완료',
  PAUSED: '멈춤',
  DROPPED: '그만둠',
}

/** 진행 중 목표 최대 개수(docs/design.md 11-6 2-2 ⑦) */
export const MAX_ACTIVE_GOALS = 3

export type CategoryRef = { id: number; name: string; color: string; active: boolean; icon?: string | null }

export type Goal = {
  id: number
  title: string
  category: CategoryRef
  /** 기한. null이면 정하지 않음 */
  targetDate: string | null
  status: GoalStatus
}

export type GoalInput = { title: string; categoryId: number; targetDate: string | null }

/** 계획 화면의 목표 한 줄(분) */
export type GoalWeekRow = { goal: Goal; targetMinutes: number; scheduledMinutes: number; actualMinutes: number }

export type WeekPlan = {
  weekStart: string
  goals: GoalWeekRow[]
  targetMinutes: number
  scheduledMinutes: number
  actualMinutes: number
}

export const getGoals = () => api.get<Goal[]>('/api/goals')
export const createGoal = (input: GoalInput) => api.post<Goal>('/api/goals', input)
export const updateGoal = (id: number, input: GoalInput) => api.put<Goal>(`/api/goals/${id}`, input)
export const changeGoalStatus = (id: number, status: GoalStatus) => api.patch<Goal>(`/api/goals/${id}/status`, { status })
export const deleteGoal = (id: number) => api.delete<void>(`/api/goals/${id}`)

export const getWeekPlan = (weekStart: string) => api.get<WeekPlan>(`/api/plan/week?start=${weekStart}`)
export const setGoalWeekMinutes = (id: number, weekStart: string, minutes: number) =>
  api.put<GoalWeekRow>(`/api/goals/${id}/weeks/${weekStart}`, { minutes })
