// 상태 색 규칙(docs/design.md 1-4c): 진행 중 기간에서 경과율 − 진행률 ≥ 20%p면 위험
import { shiftDate } from './date'

export type Health = 'done' | 'on' | 'risk' | 'idle'

export const HEALTH_LABELS: Record<Health, string> = { done: '달성', on: '순조', risk: '위험', idle: '기간 밖' }

export const RISK_GAP = 20

const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1

/** 기간 [from, to]의 오늘까지 경과율(0~100). 시작 전 0, 끝난 뒤 100 */
export function elapsedPercent(from: string, to: string, today: string) {
  if (today < from) return 0
  if (today > to) return 100
  return Math.round((days(from, today) / days(from, to)) * 100)
}

export function healthOf(percent: number, from: string, to: string, today: string, achieved = false): Health {
  if (achieved || percent >= 100) return 'done'
  if (today < from || today > to) return 'idle'
  return elapsedPercent(from, to, today) - percent >= RISK_GAP ? 'risk' : 'on'
}

/** 'YYYY-MM'의 첫날·말일 */
export const monthRange = (month: string) => {
  const first = `${month}-01`
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  return { from: first, to: last }
}

/** 월요일부터 일요일까지 */
export const weekRange = (monday: string) => ({ from: monday, to: shiftDate(monday, 6) })
