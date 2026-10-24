import { api } from './client'

/** 진행·완료. 그만둔 목표는 지운다(docs/design.md 11-6 2-2 추가 결정) */
export type GoalStatus = 'ACTIVE' | 'DONE'

export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  ACTIVE: '진행 중',
  DONE: '완료',
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

/** 목표 색은 목표와 1:1인 분류의 색이 된다(docs/design.md 11-6 2-2 추가 결정) */
export type GoalInput = { title: string; color: string; targetDate: string | null }

/** 계획 화면의 목표 한 줄(분) */
export type GoalWeekRow = { goal: Goal; scheduledMinutes: number; actualMinutes: number }

export type WeekPlan = {
  weekStart: string
  goals: GoalWeekRow[]
  scheduledMinutes: number
  actualMinutes: number
}

export const getGoals = () => api.get<Goal[]>('/api/goals')
export const createGoal = (input: GoalInput) => api.post<Goal>('/api/goals', input)
export const updateGoal = (id: number, input: GoalInput) => api.put<Goal>(`/api/goals/${id}`, input)
export const changeGoalStatus = (id: number, status: GoalStatus) => api.patch<Goal>(`/api/goals/${id}/status`, { status })
export const deleteGoal = (id: number) => api.delete<void>(`/api/goals/${id}`)

export const getWeekPlan = (weekStart: string) => api.get<WeekPlan>(`/api/plan/week?start=${weekStart}`)
