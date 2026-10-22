// 날짜는 'YYYY-MM-DD', 월은 'YYYY-MM' 문자열로 다룬다. 브라우저 시간대 영향을 받지 않도록 UTC로 계산한다.

const parse = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

const format = (date: Date) => date.toISOString().slice(0, 10)

const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

/** 서울 기준 오늘 */
export const todaySeoul = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date())

export const currentMonthSeoul = () => todaySeoul().slice(0, 7)

/** 해당 날짜가 속한 주의 월요일 */
export const mondayOf = (date: string) => {
  const d = parse(date)
  return format(addDays(d, -((d.getUTCDay() + 6) % 7)))
}

/** 그 달에 속한 주(목요일이 그 달에 있는 주)의 월요일 목록 */
export function mondaysOfMonth(month: string): string[] {
  const [y, m] = month.split('-').map(Number)
  let thursday = new Date(Date.UTC(y, m - 1, 1))
  while (thursday.getUTCDay() !== 4) thursday = addDays(thursday, 1)

  const mondays: string[] = []
  while (thursday.getUTCMonth() === m - 1) {
    mondays.push(format(addDays(thursday, -3)))
    thursday = addDays(thursday, 7)
  }
  return mondays
}

/** '10/19 ~ 10/25' */
export function weekLabel(weekStart: string) {
  const start = parse(weekStart)
  const end = addDays(start, 6)
  return `${start.getUTCMonth() + 1}/${start.getUTCDate()} ~ ${end.getUTCMonth() + 1}/${end.getUTCDate()}`
}

/** '2026-10' → '2026년 10월' */
export const monthLabel = (month: string) => `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월`

/** '2026-10' + 1 → '2026-11' */
export function addMonths(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7)
}

/** 월요일부터 일요일까지 7일 */
export const weekDates = (monday: string) => Array.from({ length: 7 }, (_, i) => format(addDays(parse(monday), i)))

/** 날짜 문자열에 days일을 더한다 */
export const shiftDate = (date: string, days: number) => format(addDays(parse(date), days))

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

/** '2026-10-22' → '10월 22일 (목)' */
export function dayLabel(date: string) {
  const d = parse(date)
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAY_LABELS[d.getUTCDay()]})`
}

// ---- 시각 (서울 기준) ----

const seoulFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** ISO 시각 → 서울 기준 'YYYY-MM-DD HH:mm' */
const seoulParts = (iso: string | Date) => seoulFormatter.format(typeof iso === 'string' ? new Date(iso) : iso)

/** 지금 서울 시각을 그날 0시부터의 분으로 */
export const nowMinutesSeoul = () => {
  const [h, m] = seoulParts(new Date()).slice(11, 16).split(':').map(Number)
  return h * 60 + m
}

/** date 0시부터의 분(다음 날 0시는 1440) */
export function minutesOfDay(iso: string, date: string) {
  const parts = seoulParts(iso)
  const [h, m] = parts.slice(11, 16).split(':').map(Number)
  return (parts.slice(0, 10) === date ? 0 : 1440) + h * 60 + m
}

/** 분 → 'HH:mm' (1440은 '24:00') */
export const formatMinutes = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

/** 'HH:mm' → 분 */
export const parseTime = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** date의 0시부터 minutes분 뒤를 서울 오프셋 ISO 문자열로 (1440이면 다음 날 00:00) */
export const seoulIso = (date: string, minutes: number) =>
  minutes >= 1440
    ? `${shiftDate(date, 1)}T${formatMinutes(minutes - 1440)}:00+09:00`
    : `${date}T${formatMinutes(minutes)}:00+09:00`
