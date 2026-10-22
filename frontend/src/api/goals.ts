import { api } from './client'

export type GoalStatus = 'ACTIVE' | 'DONE' | 'DROPPED'

export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  ACTIVE: '진행 중',
  DONE: '완료',
  DROPPED: '중단',
}

export type Progress = { achieved: number; total: number; percent: number }

export type CategoryRef = { id: number; name: string; color: string; active: boolean }

export type WeeklyGoal = {
  id: number
  monthlyGoalId: number
  weekStart: string
  content: string
  category: CategoryRef | null
  achieved: boolean
}

export type MonthlyGoal = {
  id: number
  goalId: number
  month: string
  content: string
  targetValue: number | null
  currentValue: number | null
  unit: string | null
  achieved: boolean
  progress: Progress
  weeklyGoals: WeeklyGoal[]
}

export type Goal = {
  id: number
  title: string
  description: string | null
  startDate: string
  targetDate: string
  status: GoalStatus
  progress: Progress
  monthlyGoals: MonthlyGoal[]
}

export type GoalInput = {
  title: string
  description: string | null
  startDate: string
  targetDate: string
  status: GoalStatus
}

export type MonthlyGoalInput = {
  month: string
  content: string
  targetValue: number | null
  currentValue: number | null
  unit: string | null
  achieved: boolean
}

export type WeeklyGoalInput = {
  weekStart: string
  content: string
  categoryId: number | null
  achieved: boolean
}

export const toWeeklyInput = (w: WeeklyGoal): WeeklyGoalInput => ({
  weekStart: w.weekStart,
  content: w.content,
  categoryId: w.category?.id ?? null,
  achieved: w.achieved,
})

export const getGoals = () => api.get<Goal[]>('/api/goals')
export const createGoal = (input: GoalInput) => api.post<Goal>('/api/goals', input)
export const updateGoal = (id: number, input: GoalInput) => api.put<Goal>(`/api/goals/${id}`, input)
export const deleteGoal = (id: number) => api.delete<void>(`/api/goals/${id}`)

export const createMonthlyGoal = (goalId: number, input: MonthlyGoalInput) =>
  api.post<MonthlyGoal>('/api/monthly-goals', { goalId, ...input })
export const updateMonthlyGoal = (id: number, input: MonthlyGoalInput) =>
  api.put<MonthlyGoal>(`/api/monthly-goals/${id}`, input)
export const deleteMonthlyGoal = (id: number) => api.delete<void>(`/api/monthly-goals/${id}`)

export const createWeeklyGoal = (monthlyGoalId: number, input: WeeklyGoalInput) =>
  api.post<WeeklyGoal>('/api/weekly-goals', { monthlyGoalId, ...input })
export const updateWeeklyGoal = (id: number, input: WeeklyGoalInput) =>
  api.put<WeeklyGoal>(`/api/weekly-goals/${id}`, input)
export const deleteWeeklyGoal = (id: number) => api.delete<void>(`/api/weekly-goals/${id}`)
