import { api } from './client'
import type { CategoryRef } from './goals'

export type StatsSummary = {
  from: string
  to: string
  days: number
  /** 순 공부시간 = 집중 + 수동 기록 */
  totalSeconds: number
  focusSeconds: number
  manualSeconds: number
  distractionSeconds: number
  dailyAverageSeconds: number
  distractionRatio: number
  studyDays: number
  streakDays: number
  targetSeconds: number | null
}

export type CategoryStat = {
  category: CategoryRef | null
  seconds: number
  ratio: number
  targetRatio: number | null
  targetSeconds: number | null
}

export type StatsUnit = 'day' | 'week' | 'month'

export type Timeseries = {
  unit: string
  categories: CategoryRef[]
  buckets: { start: string; totalSeconds: number; byCategory: { categoryId: number | null; seconds: number }[] }[]
}

export type Heatmap = { cells: { dayOfWeek: number; hour: number; seconds: number }[]; maxSeconds: number }

const range = (from: string, to: string) => `from=${from}&to=${to}`

export const getStatsSummary = (from: string, to: string) => api.get<StatsSummary>(`/api/stats/summary?${range(from, to)}`)

export const getStatsByCategory = (from: string, to: string) =>
  api.get<CategoryStat[]>(`/api/stats/by-category?${range(from, to)}`)

export const getTimeseries = (from: string, to: string, unit: StatsUnit) =>
  api.get<Timeseries>(`/api/stats/timeseries?${range(from, to)}&unit=${unit}`)

export const getHeatmap = (from: string, to: string) => api.get<Heatmap>(`/api/stats/heatmap?${range(from, to)}`)

/** 기간 길이로 추이 단위를 고른다(docs/design.md 1-4b) */
export function unitFor(from: string, to: string): StatsUnit {
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1
  if (days <= 31) return 'day'
  return days <= 180 ? 'week' : 'month'
}
