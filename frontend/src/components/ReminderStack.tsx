import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { formatDuration } from '../api/focus'
import { CONDITION_LABELS, getDailyLog, type DailyLog } from '../api/records'
import { getWeeklyJournals } from '../api/reviews'
import { getTimeBlocksBetween } from '../api/timeBlocks'
import nowIcon from '../assets/reminders/now.svg'
import shutdownIcon from '../assets/reminders/shutdown.svg'
import soonIcon from '../assets/reminders/soon.svg'
import todayIcon from '../assets/reminders/today.svg'
import weeklyIcon from '../assets/reminders/weekly.svg'
import { journalDue } from '../pages/plan/planData'
import { formatMinutes, minutesOfDay, mondayOf, nowMinutesSeoul, todaySeoul } from '../utils/date'
import { REMINDER_REFRESH } from '../utils/reminders'


const SHUTDOWN_HOUR = 21
const CHECK_INTERVAL_MS = 60_000
/** 시작 몇 분 전부터 "곧 시작"을 알릴지 */
const SOON_MINUTES = 15

type Kind = 'shutdown' | 'weekly' | 'today' | `block-${number}`

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
  const [state, setState] = useState<{ shutdown: boolean; weekly: boolean; block: BlockAlert | null; log: DailyLog | null }>({
    shutdown: false,
    weekly: false,
    block: null,
    log: null,
  })
  const [hidden, setHidden] = useState<Kind[]>([])
  const today = todaySeoul()
  const monday = mondayOf(today)

  const check = useCallback(() => {
    const date = todaySeoul()
    const week = mondayOf(date)
    const shutdownTime = nowMinutesSeoul() >= SHUTDOWN_HOUR * 60
    Promise.all([
      getDailyLog(date),
      journalDue(week, date) && !readDismissed('weekly', date)
        ? getWeeklyJournals(week, week).then((list) => list.length === 0)
        : Promise.resolve(false),
      getTimeBlocksBetween(date, date),
    ])
      .then(([log, weekly, blocks]) => {
        const shutdown = shutdownTime && !readDismissed('shutdown', date) && !log.saved
        // 지금 하는 블록, 없으면 SOON_MINUTES 안에 시작하는 블록(Google Calendar 일정 알림 방식). 닫은 블록은 빼고
        const now = nowMinutesSeoul()
        const spans = blocks
          .map((b) => ({ id: b.id, label: b.label, start: minutesOfDay(b.startAt, date), end: minutesOfDay(b.endAt, date), now }))
          .filter((x) => !readDismissed(`block-${x.id}`, date))
          .sort((a, b) => a.start - b.start)
        const block =
          spans.find((x) => x.start <= now && now < x.end) ?? spans.find((x) => x.start > now && x.start - now <= SOON_MINUTES) ?? null
        setState({ shutdown, weekly, block, log })
      })
      .catch(() => setState({ shutdown: false, weekly: false, block: null, log: null }))
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
    setState((s) => (kind.startsWith('block-') ? { ...s, block: null } : kind === 'today' ? { ...s } : { ...s, [kind]: false }))
    setHidden((h) => [...h, kind])
  }

  const b = state.block
  const log = state.log
  // 일정 화면에서는 오늘 숫자와 하루 마무리를 카드로(1-4f ⑮). 21시 이후 마무리 알림이 뜨면 그쪽이 대신한다
  const showToday = location.pathname === '/' && !!log && !state.shutdown && !hidden.includes('today') && !readDismissed('today', today)
  if (!state.shutdown && !state.weekly && !b && !showToday) return null

  return (
    <div className="reminder-stack" role="region" aria-label="알림">
      {showToday && log && (
        <ReminderCard
          icon={todayIcon}
          title="오늘"
          onClose={() => dismiss('today')}
          body={
            <span title="지나간 계획 시간 중 계획과 같은 일을 실제로 한 비율">
              실제 공부 <b>{formatDuration(log.summary.plan.actualStudyMinutes * 60)}</b>
              {log.summary.plan.asPlannedPercent != null && (
                <>
                  {' '}
                  · 계획대로 <b>{log.summary.plan.asPlannedPercent}%</b>
                </>
              )}
            </span>
          }
          actions={
            <button className="reminder-btn" onClick={() => navigate('/?shutdown=1')}>
              {log.saved ? `오늘 기록 보기 ${log.condition ? CONDITION_LABELS[log.condition] : ''}` : '하루 마무리'}
            </button>
          }
        />
      )}
      {b && (
        <ReminderCard
          icon={b.start <= b.now ? nowIcon : soonIcon}
          title={b.start <= b.now ? `지금 · ${b.label}` : `곧 시작 · ${b.label}`}
          onClose={() => dismiss(`block-${b.id}`)}
          body={
            b.start <= b.now
              ? `${formatMinutes(b.end)}까지 · ${b.end - b.now}분 남음`
              : `${formatMinutes(b.start)} 시작 · ${b.start - b.now}분 뒤`
          }
          progress={b.start <= b.now ? (b.now - b.start) / Math.max(1, b.end - b.start) : undefined}
        />
      )}
      {state.weekly && (
        <ReminderCard
          icon={weeklyIcon}
          title="한 주가 끝나가요"
          onClose={() => dismiss('weekly')}
          body="이번 주를 돌아보고 다음 주에 바꿀 한 가지를 정해요."
          actions={
            <>
              <Link className="reminder-btn primary" to={`/plan?level=week&date=${monday}#journal`} onClick={() => dismiss('weekly')}>
                주간 일지 쓰기
              </Link>
              <button className="reminder-btn" onClick={() => dismiss('weekly')}>
                나중에
              </button>
            </>
          }
        />
      )}
      {state.shutdown && (
        <ReminderCard
          icon={shutdownIcon}
          title="저녁 9시가 지났어요"
          onClose={() => dismiss('shutdown')}
          body="오늘을 마무리하고 내일을 가볍게 시작해요."
          actions={
            <>
              <button className="reminder-btn primary" onClick={() => navigate('/?shutdown=1')}>
                하루 마무리
              </button>
              <button className="reminder-btn" onClick={() => dismiss('shutdown')}>
                나중에
              </button>
            </>
          }
        />
      )}
    </div>
  )
}

type CardProps = {
  icon: string
  title: string
  body: ReactNode
  actions?: ReactNode
  /** 0~1. 지금 하는 일정이 얼마나 지났는지 */
  progress?: number
  onClose: () => void
}

/** 알림 카드 한 장: 왼쪽 그라데이션 아이콘 타일 + 제목·설명·버튼(1-4f ⑯) */
function ReminderCard({ icon, title, body, actions, progress, onClose }: CardProps) {
  return (
    <div className="reminder-card" role="status">
      <img className="reminder-icon" src={icon} alt="" aria-hidden="true" width={40} height={40} draggable={false} />
      <div className="reminder-main">
        <strong className="reminder-title">{title}</strong>
        <p className="reminder-body">{body}</p>
        {progress !== undefined && (
          <span className="reminder-progress">
            <span style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} />
          </span>
        )}
        {actions && <span className="reminder-actions">{actions}</span>}
      </div>
      <button className="reminder-close" onClick={onClose} aria-label="오늘은 닫기" title="오늘은 닫기">
        ×
      </button>
    </div>
  )
}
