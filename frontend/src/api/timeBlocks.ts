import { api } from './client'
import type { DailyGoalStatus, DailyGoalType } from './dailyGoals'
import type { CategoryRef } from './goals'

export type TimeBlock = {
  id: number
  dailyGoalId: number
  dailyGoalContent: string
  dailyGoalType: DailyGoalType
  dailyGoalStatus: DailyGoalStatus
  category: CategoryRef | null
  date: string
  startAt: string
  endAt: string
}

export type TimeBlockInput = { dailyGoalId: number; startAt: string; endAt: string }

export const getTimeBlocks = (date: string) => api.get<TimeBlock[]>(`/api/time-blocks?date=${date}`)

export const createTimeBlock = (input: TimeBlockInput) => api.post<TimeBlock>('/api/time-blocks', input)

export const updateTimeBlock = (id: number, input: TimeBlockInput) =>
  api.put<TimeBlock>(`/api/time-blocks/${id}`, input)

export const deleteTimeBlock = (id: number) => api.delete<void>(`/api/time-blocks/${id}`)

export const getTimeBlocksBetween = (from: string, to: string) =>
  api.get<TimeBlock[]>(`/api/time-blocks?from=${from}&to=${to}`)
