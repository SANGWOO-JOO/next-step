import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getCategories, type Category } from '../api/categories'
import { errorMessage } from '../api/client'
import {
  getDailyGoalsBetween,
  getUnfinishedDailyGoals,
  moveDailyGoal,
  type DailyGoal,
} from '../api/dailyGoals'
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
import { getHealth, type Health } from '../api/health'
import { getDailyLog, getManualLogs, type DailyLog, type ManualStudyLog } from '../api/records'
import { getWeeklyPlansOfDate, type WeeklyPlan } from '../api/weeklyPlans'
import { getTimeBlocksBetween, type TimeBlock } from '../api/timeBlocks'
import CategoryBadge from '../components/CategoryBadge'
import DailyGoalPanel from '../components/DailyGoalPanel'
import DailyLogCard from '../components/DailyLogCard'
import WeeklyPlanItem from '../components/WeeklyPlanItem'
import ScheduleView from '../components/ScheduleView'
import { dayLabel, formatMinutes, minutesOfDay, mondayOf, nowMinutesSeoul, todaySeoul, weekDates } from '../utils/date'
import { plannedKey } from './plan/planData'

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

      {weeklyGoals && <WeekPlanBanner today={today} monday={thisMonday} hasWeeklyGoals={weeklyGoals.length > 0} />}

      {unfinished.length > 0 && (
        <UnfinishedCard goals={unfinished} today={today} weeklyGoals={weeklyGoals ?? []} run={run} />
      )}

      {plans.length > 0 && (
        <div className="card">
          <h3 className="timeline-title">이번 주 계획 중 오늘 할 것</h3>
          <ul className="plan-list today-plans">
            {plans.map((p) => (
              <WeeklyPlanItem
                key={p.id}
                plan={p}
                hasDailyGoal={goals.some((g) => g.content === p.content)}
                run={run}
              />
            ))}
          </ul>
        </div>
      )}

      <div className="today-grid today-layout">
        <div className="card">
          <DailyGoalPanel
            key={today}
            date={today}
            title="오늘 할 일"
            goals={goals}
            weeklyGoals={weeklyGoals ?? []}
            categories={categories}
            run={run}
            timeBlocks={blocks.filter((b) => b.date === today)}
            onStartFocus={current ? undefined : startFocusFor}
          />
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
            dates={view === 'day' ? [today] : weekDates(thisMonday)}
            blocks={blocks}
            goals={weekGoals}
            sessions={weekSessions}
            run={run}
            onStartFocus={current ? undefined : startFocusFor}
          />
        </div>
      </div>

      <DailyLogCard date={today} log={dailyLog} manualLogs={manualLogs} categories={categories} run={run} />

      <ServerStatus />
    </section>
  )
}

type UnfinishedProps = {
  goals: DailyGoal[]
  today: string
  weeklyGoals: WeeklyGoal[]
  run: (action: () => Promise<unknown>) => Promise<boolean>
}

/** 지난 날짜의 미완료 목표를 오늘로 옮긴다. 지난주 목표는 이번 주 주간 목표를 골라 연결한다. */
function UnfinishedCard({ goals, today, weeklyGoals, run }: UnfinishedProps) {
  const [open, setOpen] = useState(false)
  const [pickedId, setPickedId] = useState<number | null>(null)
  const thisMonday = mondayOf(today)
  const weeklyGoalId = weeklyGoals.find((w) => w.id === pickedId)?.id ?? weeklyGoals[0]?.id ?? null
  const needsWeekly = (g: DailyGoal) => mondayOf(g.date) !== thisMonday
  const movable = (g: DailyGoal) => !needsWeekly(g) || weeklyGoalId !== null

  const moveToToday = (g: DailyGoal) => moveDailyGoal(g.id, today, needsWeekly(g) ? weeklyGoalId : null)

  const moveAll = () =>
    run(async () => {
      // 차례대로 옮겨야 핵심 3개 제한이 순서대로 적용된다
      for (const g of goals.filter(movable)) await moveToToday(g)
    })

  return (
    <div className="card warning-card">
      <div className="goal-header">
        <strong className="goal-title">지난 미완료 {goals.length}개</strong>
        <button onClick={moveAll} disabled={!goals.some(movable)}>
          모두 오늘로
        </button>
        <button className="ghost" onClick={() => setOpen(!open)}>
          {open ? '접기' : '하나씩 보기'}
        </button>
      </div>
      {goals.some(needsWeekly) &&
        (weeklyGoals.length > 0 ? (
          <p className="inline-form small">
            지난주 목표는 이번 주 주간 목표에 연결돼요:
            <select
              value={weeklyGoalId ?? ''}
              onChange={(e) => setPickedId(Number(e.target.value))}
              aria-label="연결할 이번 주 주간 목표"
            >
              {weeklyGoals.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.content}
                </option>
              ))}
            </select>
          </p>
        ) : (
          <p className="muted small">지난주 목표를 옮기려면 이번 주 주간 목표가 먼저 있어야 해요.</p>
        ))}
      {open && (
        <ul className="unfinished-list">
          {goals.map((g) => (
            <li key={g.id}>
              <span className="muted small">{dayLabel(g.date)}</span>
              <span>{g.content}</span>
              {g.category && <CategoryBadge name={g.category.name} color={g.category.color} />}
              {g.carryCount > 0 && <span className="carry">↻{g.carryCount}</span>}
              <button className="ghost" disabled={!movable(g)} onClick={() => run(() => moveToToday(g))}>
                오늘로
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ServerStatus() {
  const [health, setHealth] = useState<Health | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch(() => setFailed(true))
  }, [])

  return (
    <p className="muted small server-status">
      서버{' '}
      {failed ? (
        <span className="status down">연결 실패</span>
      ) : (
        <>
          <span className={health?.status === 'UP' ? 'status up' : 'status'}>{health?.status ?? '…'}</span> · DB{' '}
          <span className={health?.database === 'UP' ? 'status up' : 'status down'}>{health?.database ?? '…'}</span>
        </>
      )}
    </p>
  )
}

/** 월요일이거나 이번 주 주간 목표가 없으면 '이번 주 계획하기'를 띄운다(docs/design.md 1-4c). 월요일 배너는 이번 주만 닫을 수 있다. */
function WeekPlanBanner({ today, monday, hasWeeklyGoals }: { today: string; monday: string; hasWeeklyGoals: boolean }) {
  const read = () => {
    try {
      return localStorage.getItem(plannedKey(monday)) === '1'
    } catch {
      return false
    }
  }
  const [dismissed, setDismissed] = useState(read)
  const show = !hasWeeklyGoals || (today === monday && !dismissed)
  if (!show) return null

  const dismiss = () => {
    try {
      localStorage.setItem(plannedKey(monday), '1')
    } catch {
      // 저장 못 해도 지금은 닫는다
    }
    setDismissed(true)
  }

  return (
    <p className="focus-banner plan-banner">
      <span>{hasWeeklyGoals ? '새로운 한 주예요. 지난주를 돌아보고 이번 주를 계획해요.' : '이번 주 주간 목표가 아직 없어요.'}</span>
      <span className="row-actions">
        <Link to={`/plan?level=week&date=${monday}`}>이번 주 계획하기 ▶</Link>
        {hasWeeklyGoals && (
          <button className="icon" onClick={dismiss} aria-label="이번 주는 닫기">
            ×
          </button>
        )}
      </span>
    </p>
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
