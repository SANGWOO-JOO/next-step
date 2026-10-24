import { api } from './client'

/** 내 공부 리포트(docs/design.md 11-6 2-8) */
export type ReportPeriod = 'WEEK' | 'MONTH'

/** 요일(주 보기) 또는 주(달 보기) 한 칸. 분 */
export type ReportBucket = { start: string; plannedMinutes: number; actualMinutes: number }

export type ReportGoal = {
  id: number
  title: string
  color: string
  icon: string | null
  plannedMinutes: number
  actualMinutes: number
  topDetail: string | null
  topDetailMinutes: number
}

export type Report = {
  period: ReportPeriod
  from: string
  to: string
  actualMinutes: number
  plannedMinutes: number
  previousActualMinutes: number
  studyDays: number
  streakDays: number
  buckets: ReportBucket[]
  goals: ReportGoal[]
  /** 이번 주 보기일 때 지난 주 AI 피드백(JSON) */
  lastWeekFeedback: string | null
}

export const getReport = (period: ReportPeriod, start: string) => api.get<Report>(`/api/report?period=${period}&start=${start}`)
