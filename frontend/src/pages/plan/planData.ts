import { mondayOf, mondaysOfMonth, shiftDate } from '../../utils/date'

export type Run = (action: () => Promise<unknown>) => Promise<boolean>

/** 계획을 마친 주는 일정 화면의 월요일 배너를 띄우지 않는다(브라우저에만 저장) */
export const plannedKey = (monday: string) => `plan.week.${monday}.done`

/** 주간 일지를 펼칠 때: 지난 주이거나, 이번 주의 금~일요일 */
export const journalDue = (monday: string, today: string) => monday < mondayOf(today) || today >= shiftDate(monday, 4)

/** 월간 회고를 펼칠 때: 지난 달이거나, 그 달의 마지막 주(마지막 월요일)부터 */
export const reviewDue = (month: string, today: string) => {
  const mondays = mondaysOfMonth(month)
  return today.slice(0, 7) > month || today >= mondays[mondays.length - 1]
}
