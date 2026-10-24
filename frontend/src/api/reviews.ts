import { api } from './client'
import type { DailySummary } from './records'

export type DayStats = { date: string; condition: number | null; summary: DailySummary }

export type WeekStats = {
  weekStart: string
  studySeconds: number
  focusSeconds: number
  manualMinutes: number
  distractionSeconds: number
  goalsDone: number
  goalsTotal: number
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
/** 공부 시간: 실제 기록 기준(없는 날은 지난 집중 세션) + 수동 기록. 서버가 계산한 값 */
export const studySeconds = (s: { studySeconds: number }) => s.studySeconds

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

export type WeeklyJournalBrief = {
  weekStart: string
  good: string | null
  bad: string | null
  nextAction: string | null
  updatedAt: string
}

/** 저장된 주간 일지 목록(from~to는 월요일) */
export const getWeeklyJournals = (from: string, to: string) =>
  api.get<WeeklyJournalBrief[]>(`/api/weekly-journals?from=${from}&to=${to}`)
