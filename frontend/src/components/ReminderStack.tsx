import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getDailyLog } from '../api/records'
import { getWeeklyJournals } from '../api/reviews'
import { journalDue } from '../pages/plan/planData'
import { mondayOf, nowMinutesSeoul, todaySeoul } from '../utils/date'
import { REMINDER_REFRESH } from '../utils/reminders'


const SHUTDOWN_HOUR = 21
const CHECK_INTERVAL_MS = 5 * 60_000

type Kind = 'shutdown' | 'weekly'
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
 */
export default function ReminderStack() {
  const location = useLocation()
  const navigate = useNavigate()
  const [state, setState] = useState<{ shutdown: boolean; weekly: boolean }>({ shutdown: false, weekly: false })
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
    ])
      .then(([shutdown, weekly]) => setState({ shutdown, weekly }))
      .catch(() => setState({ shutdown: false, weekly: false }))
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
    setState((s) => ({ ...s, [kind]: false }))
  }

  if (!state.shutdown && !state.weekly) return null

  return (
    <div className="reminder-stack" role="region" aria-label="알림">
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
