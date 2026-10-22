import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getCategories, type Category } from '../api/categories'
import { errorMessage } from '../api/client'
import { getDailyGoalsBetween, getUnfinishedDailyGoals, type DailyGoal } from '../api/dailyGoals'
import { getWeeklyGoalsOfWeek, type WeeklyGoal } from '../api/goals'
import {
  DEFAULT_BREAK_MINUTES,
  DEFAULT_FOCUS_MINUTES,
  formatDuration,
  getCurrentFocus,
  getDistractionNotes,
  getFocusSessions,
  startFocus,
  type FocusSession,
} from '../api/focus'
import { getHealth } from '../api/health'
import { CONDITION_LABELS, getDailyLog, getManualLogs, type DailyLog, type ManualStudyLog } from '../api/records'
import { getWeeklyJournals } from '../api/reviews'
import { getWeeklyPlansOfDate, type WeeklyPlan } from '../api/weeklyPlans'
import { getTimeBlocksBetween, type TimeBlock } from '../api/timeBlocks'
import DailyGoalPanel from '../components/DailyGoalPanel'
import PullSection from '../components/today/PullSection'
import ShutdownDialog from '../components/today/ShutdownDialog'
import ScheduleView from '../components/ScheduleView'
import { dayLabel, formatMinutes, minutesOfDay, mondayOf, nowMinutesSeoul, todaySeoul, weekDates } from '../utils/date'
import { journalDue, plannedKey } from './plan/planData'

export default function TodayPage() {
  const today = todaySeoul()
  const thisMonday = mondayOf(today)
  const sunday = weekDates(thisMonday)[6]
  /** 이번 주 하루 목표·블록·세션. 일 보기는 그중 오늘 것만 쓴다 */
  const [weekGoals, setWeekGoals] = useState<DailyGoal[]>([])
  const [weekSessions, setWeekSessions] = useState<FocusSession[]>([])
  const [view, setView] = useState<'day' | 'week'>(() => {
    try {
      return localStorage.getItem('today.view') === 'week' ? 'week' : 'day'
    } catch {
      return 'day'
    }
  })
  const [weeklyGoals, setWeeklyGoals] = useState<WeeklyGoal[] | null>(null)
  const [unfinished, setUnfinished] = useState<DailyGoal[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [blocks, setBlocks] = useState<TimeBlock[]>([])
  const [current, setCurrent] = useState<FocusSession | null>(null)
  const [uncheckedNotes, setUncheckedNotes] = useState(0)
  const [plans, setPlans] = useState<WeeklyPlan[]>([])
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null)
  const [manualLogs, setManualLogs] = useState<ManualStudyLog[]>([])
  const [shutdown, setShutdown] = useState(false)
  /** 고른 날: 왼쪽 목록과 [일] 보기가 보여주는 날(이번 주 안). [주] 보기의 날짜 머리로 바꾼다 */
  const [selected, setSelected] = useState(today)
  const isToday = selected === today
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    Promise.all([
      getDailyGoalsBetween(thisMonday, sunday),
      getWeeklyGoalsOfWeek(thisMonday),
      getUnfinishedDailyGoals(today),
      getCategories(),
      getTimeBlocksBetween(thisMonday, sunday),
      Promise.all(weekDates(thisMonday).filter((d) => d <= today).map(getFocusSessions)).then((all) => all.flat()),
      getCurrentFocus(),
      getDistractionNotes(false),
      getWeeklyPlansOfDate(today),
      getDailyLog(today),
      getManualLogs(today),
    ])
      .then(([d, w, u, c, b, f, cur, notes, p, log, manual]) => {
        setPlans(p)
        setDailyLog(log)
        setManualLogs(manual)
        setWeekSessions(f)
        setCurrent(cur ?? null)
        setUncheckedNotes(notes.length)
        setWeekGoals(d)
        setWeeklyGoals(w)
        setUnfinished(u)
        setCategories(c)
        setBlocks(b)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [today, thisMonday, sunday])

  useEffect(load, [load])

  const run = async (action: () => Promise<unknown>) => {
    setError(null)
    try {
      await action()
      return true
    } catch (e) {
      setError(errorMessage(e))
      return false
    } finally {
      load()
    }
  }

  const startFocusFor = async (goal: DailyGoal) => {
    const ok = await run(() =>
      startFocus({
        dailyGoalId: goal.id,
        categoryId: null,
        focusMinutes: DEFAULT_FOCUS_MINUTES,
        breakMinutes: DEFAULT_BREAK_MINUTES,
        source: 'TODAY',
      }),
    )
    if (ok) navigate('/focus')
  }

  const goals = weekGoals.filter((g) => g.date === today)
  const sessions = weekSessions.filter((s) => s.date === today)
  const changeView = (v: 'day' | 'week') => {
    setView(v)
    try {
      localStorage.setItem('today.view', v)
    } catch {
      // 저장 못 해도 화면은 그대로 쓸 수 있다
    }
  }

  // 진행 중 세션은 서버가 응답 시각까지 계산한 값이다
  const focusTotal = sessions.reduce((sum, s) => sum + s.focusSeconds, 0)

  return (
    <section>
      <div className="page-head">
        <h1>
          일정 <span className="page-date muted">{dayLabel(today)}</span>
        </h1>
        <div className="status-bar">
          {current ? (
            <span className="status-focus">
              {current.interruptions.some((i) => !i.endedAt) ? '⏸ 중단 중' : '▶ 집중 중'} ·{' '}
              {current.dailyGoal?.content ?? current.category?.name ?? '분류 없음'}
              <Link className="button-link" to="/focus">
                돌아가기
              </Link>
            </span>
          ) : null}
          <NowNext blocks={blocks.filter((b) => b.date === today)} />
          <span className="muted">
            오늘 집중 <strong className="status-strong">{formatDuration(focusTotal)}</strong> ({sessions.length}회)
          </span>
          {uncheckedNotes > 0 && <Link to="/focus#notes">확인 안 한 메모 {uncheckedNotes}개</Link>}
          {!current && <Link to="/focus">분류만으로 집중하기</Link>}
          <span className="status-end">
            {dailyLog?.saved && (
              <button className="ghost log-chip" onClick={() => setShutdown(true)} title="오늘 기록 보기·고치기">
                오늘 기록 ✓ {dailyLog.condition ? CONDITION_LABELS[dailyLog.condition] : ''}
              </button>
            )}
            {!dailyLog?.saved && <button onClick={() => setShutdown(true)}>🌙 하루 마무리</button>}
          </span>
        </div>
      </div>
      {error && (
        <p className="error-banner" role="alert">
          {error}
          <button className="icon" onClick={() => setError(null)} aria-label="닫기">
            ×
          </button>
        </p>
      )}

      <AlertSlot
        today={today}
        monday={thisMonday}
        hasWeeklyGoals={weeklyGoals === null ? null : weeklyGoals.length > 0}
        logSaved={dailyLog?.saved ?? true}
        onShutdown={() => setShutdown(true)}
      />

      <div className="today-grid today-layout">
        <div className="card">
          {isToday ? (
            <Workload blocks={blocks.filter((b) => b.date === today)} goals={goals} />
          ) : (
            <div className="workload other-day">
              <span className="small">
                {dayLabel(selected)}을 보고 있어요 · 시간 잡음{' '}
                <strong>
                  {formatDuration(
                    blocks
                      .filter((b) => b.date === selected)
                      .reduce((sum, b) => sum + minutesOfDay(b.endAt, selected) - minutesOfDay(b.startAt, selected), 0) * 60,
                  )}
                </strong>
              </span>
              <button className="ghost" onClick={() => setSelected(today)}>
                오늘로 돌아가기
              </button>
            </div>
          )}
          <DailyGoalPanel
            key={selected}
            date={selected}
            title={isToday ? '오늘 할 일' : `${dayLabel(selected)} 할 일`}
            goals={weekGoals.filter((g) => g.date === selected)}
            weeklyGoals={weeklyGoals ?? []}
            categories={categories}
            run={run}
            timeBlocks={blocks.filter((b) => b.date === selected)}
            onStartFocus={current || !isToday ? undefined : startFocusFor}
          />
          {isToday && (
          <PullSection
            today={today}
            unfinished={unfinished}
            plans={plans}
            goals={goals}
            weeklyGoals={weeklyGoals ?? []}
            run={run}
          />
          )}
          {weeklyGoals?.length === 0 && (
            <p className="small">
              <Link to="/plan?level=week">계획</Link>에서 이번 주 주간 목표를 먼저 만들어 주세요.
            </p>
          )}
        </div>
        <div className="card schedule-card">
          <div className="goal-header">
            <h3 className="timeline-title goal-title">시간표</h3>
            <span className="segmented">
              {(['day', 'week'] as const).map((v) => (
                <button key={v} className={view === v ? 'active' : ''} onClick={() => changeView(v)}>
                  {v === 'day' ? '일' : '주'}
                </button>
              ))}
            </span>
          </div>
          <p className="muted small">
            빈 칸을 끌어 시간을 잡고, 블록을 끌어 옮기거나 아래 끝을 끌어 늘여요. 왼쪽 목표를 끌어다 놓아도 돼요.
            초록 막대는 실제 집중한 시간이에요.
          </p>
          <ScheduleView
            dates={view === 'day' ? [selected] : weekDates(thisMonday)}
            blocks={blocks}
            goals={weekGoals}
            sessions={weekSessions}
            run={run}
            onStartFocus={current ? undefined : startFocusFor}
            selectedDate={selected}
            onSelectDate={setSelected}
          />
        </div>
      </div>

      {shutdown && (
        <ShutdownDialog
          date={today}
          log={dailyLog}
          goals={goals}
          manualLogs={manualLogs}
          categories={categories}
          plannedMinutes={blocks
            .filter((b) => b.date === today)
            .reduce((sum, b) => sum + minutesOfDay(b.endAt, today) - minutesOfDay(b.startAt, today), 0)}
          run={run}
          onClose={() => setShutdown(false)}
        />
      )}

      <ServerAlert />
    </section>
  )
}

/** 지금 걸친 시간 블록, 없으면 다음 블록을 한 줄로 알려준다(Structured의 지금/다음 강조 참고) */
function NowNext({ blocks }: { blocks: TimeBlock[] }) {
  const [now, setNow] = useState(nowMinutesSeoul)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(nowMinutesSeoul()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  const today = todaySeoul()
  const spans = blocks
    .map((b) => ({ b, start: minutesOfDay(b.startAt, today), end: minutesOfDay(b.endAt, today) }))
    .sort((a, c) => a.start - c.start)
  const current = spans.find((x) => x.start <= now && now < x.end)
  const next = spans.find((x) => x.start > now)

  if (current) {
    return (
      <span className="status-now">
        지금 <strong>{current.b.label}</strong> · {formatMinutes(current.end)}까지 ({current.end - now}분 남음)
      </span>
    )
  }
  if (next) {
    const gap = next.start - now
    return (
      <span className="status-next">
        다음 <strong>{formatMinutes(next.start)} {next.b.label}</strong> ·{' '}
        {gap >= 60 ? `${Math.floor(gap / 60)}시간 ${gap % 60}분` : `${gap}분`} 뒤
      </span>
    )
  }
  return <span className="muted">오늘 남은 시간 블록이 없어요.</span>
}

/**
 * 알림 한 칸(docs/design.md 6장 1-4d): 그때 가장 중요한 하나만 보여준다.
 * 주간 목표 없음 > 월요일 계획하기 > 금~일 돌아보기 > 21시 이후 하루 마무리
 */
function AlertSlot({
  today,
  monday,
  hasWeeklyGoals,
  logSaved,
  onShutdown,
}: {
  today: string
  monday: string
  hasWeeklyGoals: boolean | null
  logSaved: boolean
  onShutdown: () => void
}) {
  const [planDismissed, setPlanDismissed] = useState(() => {
    try {
      return localStorage.getItem(plannedKey(monday)) === '1'
    } catch {
      return false
    }
  })
  const [journalWritten, setJournalWritten] = useState<boolean | null>(null)
  const reviewDue = journalDue(monday, today)

  useEffect(() => {
    if (!reviewDue) return
    getWeeklyJournals(monday, monday)
      .then((list) => setJournalWritten(list.length > 0))
      .catch(() => setJournalWritten(null))
  }, [reviewDue, monday])

  const dismissPlan = () => {
    try {
      localStorage.setItem(plannedKey(monday), '1')
    } catch {
      // 저장 못 해도 지금은 닫는다
    }
    setPlanDismissed(true)
  }

  if (hasWeeklyGoals === null) return null
  const planLink = `/plan?level=week&date=${monday}`
  let alert: { text: string; action: ReactNode; onClose?: () => void } | null = null
  if (!hasWeeklyGoals) {
    alert = { text: '이번 주 주간 목표가 아직 없어요.', action: <Link className="button-link" to={planLink}>이번 주 계획하기 ▶</Link> }
  } else if (today === monday && !planDismissed) {
    alert = {
      text: '새로운 한 주예요. 지난주를 돌아보고 이번 주를 계획해요.',
      action: <Link className="button-link" to={planLink}>이번 주 계획하기 ▶</Link>,
      onClose: dismissPlan,
    }
  } else if (reviewDue && journalWritten === false) {
    alert = {
      text: '한 주가 끝나가요. 이번 주를 돌아보고 다음 주에 바꿀 한 가지를 정해요.',
      action: <Link className="button-link" to={planLink}>이번 주 돌아보기</Link>,
    }
  } else if (nowMinutesSeoul() >= SHUTDOWN_HOUR * 60 && !logSaved) {
    alert = {
      text: '저녁 9시가 지났어요. 오늘을 마무리하고 내일을 가볍게 시작해요.',
      action: (
        <button onClick={onShutdown}>
          하루 마무리
        </button>
      ),
    }
  }
  if (!alert) return null

  return (
    <p className="focus-banner plan-banner">
      <span>{alert.text}</span>
      <span className="row-actions">
        {alert.action}
        {alert.onClose && (
          <button className="icon" onClick={alert.onClose} aria-label="이번 주는 닫기">
            ×
          </button>
        )}
      </span>
    </p>
  )
}

/** 하루 마무리를 안내하는 시각 */
const SHUTDOWN_HOUR = 21

/** 오늘 시간 잡은 양과 남은 시간(지금~자정). 남은 일정이 남은 시간보다 많으면 경고(Sunsama의 과부하 경고 참고) */
function Workload({ blocks, goals }: { blocks: TimeBlock[]; goals: DailyGoal[] }) {
  const today = todaySeoul()
  const now = nowMinutesSeoul()
  const spans = blocks.map((b) => ({ start: minutesOfDay(b.startAt, today), end: minutesOfDay(b.endAt, today), goalId: b.dailyGoalId }))
  const planned = spans.reduce((sum, x) => sum + x.end - x.start, 0)
  const ahead = spans.reduce((sum, x) => sum + Math.max(0, x.end - Math.max(x.start, now)), 0)
  const left = Math.max(0, 1440 - now)
  const unscheduled = goals.filter((g) => g.status === 'TODO' && !spans.some((x) => x.goalId === g.id)).length
  const over = ahead > left
  const hm = (m: number) => formatDuration(m * 60)

  return (
    <div className={over ? 'workload over' : 'workload'}>
      <span className="small">
        시간 잡음 <strong>{hm(planned)}</strong> · 남은 일정 {hm(ahead)} / 자정까지 {hm(left)}
      </span>
      <span className="workload-track">
        <span className="workload-fill" style={{ width: `${Math.min(100, left ? (ahead / left) * 100 : 100)}%` }} />
      </span>
      {over && <span className="small">남은 시간보다 잡은 일이 많아요. 내일로 넘길 것을 골라요.</span>}
      {!over && unscheduled > 0 && <span className="muted small">시간 안 잡은 할 일 {unscheduled}개</span>}
    </div>
  )
}

/** 서버 연결이 실패할 때만 알린다 */
function ServerAlert() {
  const [down, setDown] = useState(false)
  useEffect(() => {
    getHealth()
      .then((h) => setDown(h.status !== 'UP' || h.database !== 'UP'))
      .catch(() => setDown(true))
  }, [])
  if (!down) return null
  return (
    <p className="error-banner" role="alert">
      서버나 DB에 연결할 수 없어요. 백엔드와 docker compose가 켜져 있는지 확인해 주세요.
    </p>
  )
}
