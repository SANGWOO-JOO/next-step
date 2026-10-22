import { api } from './client'
import type { CategoryRef } from './goals'

export type WeeklyPlan = {
  id: number
  weeklyGoalId: number
  weeklyGoalContent: string
  category: CategoryRef | null
  date: string
  content: string
  sortOrder: number
}

export const getWeeklyPlans = (weekStart: string) => api.get<WeeklyPlan[]>(`/api/weekly-plans?weekStart=${weekStart}`)

export const getWeeklyPlansOfDate = (date: string) => api.get<WeeklyPlan[]>(`/api/weekly-plans?date=${date}`)

export const createWeeklyPlan = (input: { weeklyGoalId: number; date: string; content: string }) =>
  api.post<WeeklyPlan>('/api/weekly-plans', input)

export const updateWeeklyPlan = (id: number, input: { date: string; content: string }) =>
  api.put<WeeklyPlan>(`/api/weekly-plans/${id}`, input)

export const deleteWeeklyPlan = (id: number) => api.delete<void>(`/api/weekly-plans/${id}`)
