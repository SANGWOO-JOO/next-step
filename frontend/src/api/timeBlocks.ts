import { api } from './client'
import type { DailyGoalStatus, DailyGoalType } from './dailyGoals'
import type { CategoryRef } from './goals'

export type TimeBlock = {
  id: number
  /** null이면 목표가 아닌 일정(밥 먹기, 산책 등) */
  dailyGoalId: number | null
  dailyGoalContent: string | null
  dailyGoalType: DailyGoalType | null
  dailyGoalStatus: DailyGoalStatus | null
  title: string | null
  /** 화면에 보여줄 이름: 하루 목표 내용 또는 제목 */
  label: string
  category: CategoryRef | null
  /** 직접 고른 색(#RRGGBB). null이면 분류 색 */
  color: string | null
  date: string
  startAt: string
  endAt: string
}

/** 하루 목표가 없으면 title과 date를 보낸다 */
export type TimeBlockInput = {
  dailyGoalId: number | null
  title?: string | null
  date?: string
  startAt: string
  endAt: string
}

/** 블록의 시각만 바꿔 보낼 때 */
export const toTimeBlockInput = (b: TimeBlock, startAt: string, endAt: string): TimeBlockInput => ({
  dailyGoalId: b.dailyGoalId,
  title: b.title,
  date: b.date,
  startAt,
  endAt,
})

export const getTimeBlocks = (date: string) => api.get<TimeBlock[]>(`/api/time-blocks?date=${date}`)

export const createTimeBlock = (input: TimeBlockInput) => api.post<TimeBlock>('/api/time-blocks', input)

export const updateTimeBlock = (id: number, input: TimeBlockInput) =>
  api.put<TimeBlock>(`/api/time-blocks/${id}`, input)

/** 블록 색 바꾸기(null이면 분류 색으로) */
export const setTimeBlockColor = (id: number, color: string | null) =>
  api.patch<TimeBlock>(`/api/time-blocks/${id}/color`, { color })

export const deleteTimeBlock = (id: number) => api.delete<void>(`/api/time-blocks/${id}`)

export const getTimeBlocksBetween = (from: string, to: string) =>
  api.get<TimeBlock[]>(`/api/time-blocks?from=${from}&to=${to}`)
