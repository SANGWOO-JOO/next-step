import { api } from './client'
import type { DailySummary } from './records'

export type DayStats = { date: string; condition: number | null; summary: DailySummary }

export type WeekStats = {
  weekStart: string
  focusSeconds: number
  manualMinutes: number
  distractionSeconds: number
  goalsDone: number
  goalsTotal: number
  weeklyGoalsAchieved: number
  weeklyGoalsTotal: number
  journalWritten: boolean
}

export type WeeklyJournal = {
  weekStart: string
  saved: boolean
  good: string | null
  bad: string | null
  nextAction: string | null
  aiSummary: string | null
  updatedAt: string | null
  days: DayStats[]
  total: WeekStats
}

export type WeeklyJournalInput = { good: string | null; bad: string | null; nextAction: string | null }

export type MonthlyReview = {
  month: string
  saved: boolean
  review: string | null
  nextDirection: string | null
  aiSummary: string | null
  updatedAt: string | null
  weeks: WeekStats[]
}

export type MonthlyReviewInput = { review: string | null; nextDirection: string | null }

export const getWeeklyJournal = (weekStart: string) => api.get<WeeklyJournal>(`/api/weekly-journals/${weekStart}`)

export const saveWeeklyJournal = (weekStart: string, input: WeeklyJournalInput) =>
  api.put<WeeklyJournal>(`/api/weekly-journals/${weekStart}`, input)

export const getMonthlyReview = (month: string) => api.get<MonthlyReview>(`/api/monthly-reviews/${month}`)

export const saveMonthlyReview = (month: string, input: MonthlyReviewInput) =>
  api.put<MonthlyReview>(`/api/monthly-reviews/${month}`, input)

/** 순 공부 시간(초) = 집중 + 수동 기록 */
export const studySeconds = (s: { focusSeconds: number; manualMinutes: number }) => s.focusSeconds + s.manualMinutes * 60

export type MonthlyReviewBrief = {
  month: string
  review: string | null
  nextDirection: string | null
  aiSummary: string | null
  updatedAt: string
}

/** 저장된 월간 회고 목록 */
export const getMonthlyReviews = (from: string, to: string) =>
  api.get<MonthlyReviewBrief[]>(`/api/monthly-reviews?from=${from}&to=${to}`)
