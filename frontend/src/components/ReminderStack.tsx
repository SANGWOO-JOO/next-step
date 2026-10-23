import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getDailyLog } from '../api/records'
import { getWeeklyJournals } from '../api/reviews'
import { getTimeBlocksBetween } from '../api/timeBlocks'
import { journalDue } from '../pages/plan/planData'
import { formatMinutes, minutesOfDay, mondayOf, nowMinutesSeoul, todaySeoul } from '../utils/date'
import { REMINDER_REFRESH } from '../utils/reminders'


const SHUTDOWN_HOUR = 21
const CHECK_INTERVAL_MS = 60_000
/** 시작 몇 분 전부터 "곧 시작"을 알릴지 */
const SOON_MINUTES = 15

type Kind = 'shutdown' | 'weekly' | `block-${number}`

/** 지금 하는 블록 또는 곧 시작하는 블록 */
type BlockAlert = { id: number; label: string; start: number; end: number; now: number }
const dismissKey = (kind: Kind, date: string) => `reminder.${kind}.${date}`

const readDismissed = (kind: Kind, date: string) => {
  try {
    return localStorage.getItem(dismissKey(kind, date)) === '1'
  } catch {
    return false
  }
}

/**
 * 오른쪽 위 알림 카드(docs/design.md 1-4f ⑬, Sunsama 하루 마무리 알림·고정 알림 가이드 참고).
 * 작업을 막지 않고, 할 일을 끝내거나 닫을 때까지 남는다. 닫으면 그날은 다시 안 나온다.
 * 지금 하는 시간 블록과 15분 안에 시작하는 블록도 알려준다(블록마다 닫기, 1-4f ⑭).
 */
export default function ReminderStack() {
  const location = useLocation()
  const navigate = useNavigate()
  const [state, setState] = useState<{ shutdown: boolean; weekly: boolean; block: BlockAlert | null }>({
    shutdown: false,
    weekly: false,
    block: null,
  })
  const today = todaySeoul()
  const monday = mondayOf(today)

  const check = useCallback(() => {
    const date = todaySeoul()
    const week = mondayOf(date)
    const shutdownTime = nowMinutesSeoul() >= SHUTDOWN_HOUR * 60
    Promise.all([
      shutdownTime && !readDismissed('shutdown', date) ? getDailyLog(date).then((l) => !l.saved) : Promise.resolve(false),
      journalDue(week, date) && !readDismissed('weekly', date)
        ? getWeeklyJournals(week, week).then((list) => list.length === 0)
        : Promise.resolve(false),
      getTimeBlocksBetween(date, date),
    ])
      .then(([shutdown, weekly, blocks]) => {
        // 지금 하는 블록, 없으면 SOON_MINUTES 안에 시작하는 블록(Google Calendar 일정 알림 방식). 닫은 블록은 빼고
        const now = nowMinutesSeoul()
        const spans = blocks
          .map((b) => ({ id: b.id, label: b.label, start: minutesOfDay(b.startAt, date), end: minutesOfDay(b.endAt, date), now }))
          .filter((x) => !readDismissed(`block-${x.id}`, date))
          .sort((a, b) => a.start - b.start)
        const block =
          spans.find((x) => x.start <= now && now < x.end) ?? spans.find((x) => x.start > now && x.start - now <= SOON_MINUTES) ?? null
        setState({ shutdown, weekly, block })
      })
      .catch(() => setState({ shutdown: false, weekly: false, block: null }))
  }, [])

  useEffect(check, [check, location.pathname])
  useEffect(() => {
    const timer = window.setInterval(check, CHECK_INTERVAL_MS)
    window.addEventListener(REMINDER_REFRESH, check)
    window.addEventListener('focus', check)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener(REMINDER_REFRESH, check)
      window.removeEventListener('focus', check)
    }
  }, [check])

  const dismiss = (kind: Kind) => {
    try {
      localStorage.setItem(dismissKey(kind, today), '1')
    } catch {
      // 저장 못 해도 지금은 닫는다
    }
    setState((s) => (kind.startsWith('block-') ? { ...s, block: null } : { ...s, [kind]: false }))
  }

  if (!state.shutdown && !state.weekly && !state.block) return null
  const b = state.block

  return (
    <div className="reminder-stack" role="region" aria-label="알림">
      {b && (
        <div className="reminder-card now" role="status">
          <button className="icon reminder-close" onClick={() => dismiss(`block-${b.id}`)} aria-label="이 일정 알림 닫기">
            ×
          </button>
          {b.start <= b.now ? (
            <>
              <strong>⏱ 지금: {b.label}</strong>
              <p className="muted small">
                {formatMinutes(b.end)}까지 · {b.end - b.now}분 남음
              </p>
            </>
          ) : (
            <>
              <strong>🔔 곧 시작: {b.label}</strong>
              <p className="muted small">
                {formatMinutes(b.start)} 시작 · {b.start - b.now}분 뒤
              </p>
            </>
          )}
        </div>
      )}
      {state.shutdown && (
        <div className="reminder-card" role="status">
          <button className="icon reminder-close" onClick={() => dismiss('shutdown')} aria-label="오늘은 닫기">
            ×
          </button>
          <strong>🌙 저녁 9시가 지났어요</strong>
          <p className="muted small">오늘을 마무리하고 내일을 가볍게 시작해요.</p>
          <span className="row-actions">
            <button onClick={() => navigate('/?shutdown=1')}>하루 마무리</button>
            <button className="ghost" onClick={() => dismiss('shutdown')}>
              나중에
            </button>
          </span>
        </div>
      )}
      {state.weekly && (
        <div className="reminder-card" role="status">
          <button className="icon reminder-close" onClick={() => dismiss('weekly')} aria-label="오늘은 닫기">
            ×
          </button>
          <strong>📝 한 주가 끝나가요</strong>
          <p className="muted small">이번 주를 돌아보고 다음 주에 바꿀 한 가지를 정해요.</p>
          <span className="row-actions">
            <Link className="button-link" to={`/plan?level=week&date=${monday}#journal`} onClick={() => dismiss('weekly')}>
              주간 일지 쓰기
            </Link>
            <button className="ghost" onClick={() => dismiss('weekly')}>
              나중에
            </button>
          </span>
        </div>
      )}
    </div>
  )
}
