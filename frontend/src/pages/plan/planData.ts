import type { Goal, MonthlyGoal, WeeklyGoal } from '../../api/goals'
import { mondayOf, mondaysOfMonth, shiftDate } from '../../utils/date'

export type Run = (action: () => Promise<unknown>) => Promise<boolean>

export type Level = 'goal' | 'month' | 'week'

/** 월요일이 속한 달(목요일 기준, ISO) */
export const isoMonthOfWeek = (monday: string) => shiftDate(monday, 3).slice(0, 7)

export const allMonthlyGoals = (goals: Goal[]): MonthlyGoal[] => goals.flatMap((g) => g.monthlyGoals)

export const weeklyGoalsOf = (goals: Goal[], monday: string): WeeklyGoal[] =>
  allMonthlyGoals(goals)
    .flatMap((m) => m.weeklyGoals)
    .filter((w) => w.weekStart === monday)

/** 그 주가 속한 달의 월간 목표 */
export const monthlyGoalsOfWeek = (goals: Goal[], monday: string) =>
  allMonthlyGoals(goals).filter((m) => m.month === isoMonthOfWeek(monday))

/** 날짜가 속한 주의 월요일과, 그 주가 속한 달 */
export const anchorOf = (date: string) => {
  const monday = mondayOf(date)
  return { monday, month: isoMonthOfWeek(monday) }
}

/** 이 달에 속한 첫 주의 월요일(목요일 기준) */
export const firstMondayOf = (month: string) => {
  const first = mondayOf(`${month}-01`)
  return isoMonthOfWeek(first) === month ? first : shiftDate(first, 7)
}

/** 화면에서 이어 볼 대표 최종 목표: 진행 중인 것 중 첫 번째 */
export const activeGoal = (goals: Goal[]) => goals.find((g) => g.status === 'ACTIVE') ?? goals[0] ?? null

/** 계획을 마친 주는 오늘 화면의 월요일 배너를 띄우지 않는다(브라우저에만 저장) */
export const plannedKey = (monday: string) => `plan.week.${monday}.done`

/** 월간 목표의 진행률. 주간 목표가 있으면 달성 비율, 없으면 직접 입력한 수치 비율 */
export function monthlyPercent(m: MonthlyGoal) {
  if (m.progress.total > 0) return m.progress.percent
  if (m.targetValue && m.targetValue > 0) return Math.min(100, Math.round(((m.currentValue ?? 0) / m.targetValue) * 100))
  return 0
}

/** 주간 일지를 펼칠 때: 지난 주이거나, 이번 주의 금~일요일 */
export const journalDue = (monday: string, today: string) => monday < mondayOf(today) || today >= shiftDate(monday, 4)

/** 월간 회고를 펼칠 때: 지난 달이거나, 그 달의 마지막 주(마지막 월요일)부터 */
export const reviewDue = (month: string, today: string) => {
  const mondays = mondaysOfMonth(month)
  return today.slice(0, 7) > month || today >= mondays[mondays.length - 1]
}
