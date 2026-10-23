import { useCallback, useEffect, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getCategories, type Category } from '../api/categories'
import { errorMessage } from '../api/client'
import { createDailyGoal, getDailyGoalsBetween, getUnfinishedDailyGoals, type DailyGoal } from '../api/dailyGoals'
import { getWeeklyGoalsOfWeek, type WeeklyGoal } from '../api/goals'
import { formatDuration } from '../api/focus'
import { getHealth } from '../api/health'
import { getActualLogsBetween, type ActualLog } from '../api/actualLogs'
import { getTimeBlocksBetween, type TimeBlock } from '../api/timeBlocks'
import DailyGoalPanel, { NewDailyGoalForm } from '../components/DailyGoalPanel'
import PullSection from '../components/today/PullSection'
import DayWrapUp from '../components/today/DayWrapUp'
import { COLLAPSE_EVENT } from '../components/Layout'
import ScheduleView from '../components/ScheduleView'
import { dayLabel, minutesOfDay, mondayOf, nowMinutesSeoul, shiftDate, todaySeoul, weekDates } from '../utils/date'
import { plannedKey } from './plan/planData'

export default function TodayPage() {
  const today = todaySeoul()
  const thisMonday = mondayOf(today)
  const sunday = weekDates(thisMonday)[6]
  /** 이번 주 하루 목표·블록·세션. 일 보기는 그중 오늘 것만 쓴다 */
  const [weekGoals, setWeekGoals] = useState<DailyGoal[]>([])
  const [view, setView] = useState<'day' | 'week'>(() => {
    try {
      return localStorage.getItem('today.view') === 'week' ? 'week' : 'day'
    } catch {
      return 'day'
    }
  })
  const [weeklyGoals, setWeeklyGoals] = useState<WeeklyGoal[] | null>(null)
  /** 이번 주(오늘이 속한 주)에 주간 목표가 있는지. 알림 칸용(보는 주와 다를 수 있음) */
  const [thisWeekHasWeekly, setThisWeekHasWeekly] = useState<boolean | null>(null)
  const [unfinished, setUnfinished] = useState<DailyGoal[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [blocks, setBlocks] = useState<TimeBlock[]>([])
  /** 이번 주 실제 기록(시간표 "실제" 줄) */
  const [actuals, setActuals] = useState<ActualLog[]>([])
  // 오른쪽 위 알림의 [하루 마무리]는 /?shutdown=1로 와서 창을 연다
  const [searchParams, setSearchParams] = useSearchParams()
  const [shutdown, setShutdown] = useState(() => searchParams.get('shutdown') === '1')
  useEffect(() => {
    if (searchParams.get('shutdown') === '1') {
      setShutdown(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])
  /** 고른 날: 왼쪽 목록과 [일] 보기가 보여주는 날(이번 주 안). [주] 보기의 날짜 머리로 바꾼다 */
  const [selected, setSelected] = useState(today)
  const [leftWidth, setLeftWidth] = useState(() => readNumber(LEFT_WIDTH_KEY, DEFAULT_LEFT_WIDTH))
  // 기본은 시간표만(docs/design.md 6장 시간표 중심). 목록을 연 적이 있으면 그 상태를 기억한다
  const [wideSchedule, setWideSchedule] = useState(() => {
    try {
      return localStorage.getItem(WIDE_KEY) !== '0'
    } catch {
      return true
    }
  })
  const [pullOpen, setPullOpen] = useState(false)

  const saveLeftWidth = (w: number) => {
    const clamped = Math.round(Math.min(MAX_LEFT_WIDTH, Math.max(MIN_LEFT_WIDTH, w)))
    setLeftWidth(clamped)
    writeValue(LEFT_WIDTH_KEY, String(clamped))
  }

  // 경계를 끌면 목록 폭이 바뀐다(포인터 위치 기준)
  const startResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    const listLeft = e.currentTarget.parentElement!.getBoundingClientRect().left
    const onMove = (ev: PointerEvent) => saveLeftWidth(ev.clientX - listLeft)
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.classList.remove('resizing')
    }
    document.body.classList.add('resizing')
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const toggleWide = () => {
    const next = !wideSchedule
    setWideSchedule(next)
    writeValue(WIDE_KEY, next ? '1' : '0')
  }
  const isToday = selected === today
  const [error, setError] = useState<string | null>(null)

  // 보는 주(고른 날의 주)를 불러온다. 다른 주를 볼 때는 오늘 할 일·하루 마무리를 위해 이번 주도 함께 불러 합친다
  const viewMonday = mondayOf(selected)
  const load = useCallback(() => {
    const viewSunday = shiftDate(viewMonday, 6)
    const ranges: [string, string][] =
      viewMonday === thisMonday ? [[thisMonday, sunday]] : [[viewMonday, viewSunday], [thisMonday, sunday]]
    const each = <T,>(get: (from: string, to: string) => Promise<T[]>) =>
      Promise.all(ranges.map(([f, t]) => get(f, t))).then((all) => all.flat())
    Promise.all([
      each(getDailyGoalsBetween),
      getWeeklyGoalsOfWeek(viewMonday),
      getUnfinishedDailyGoals(today),
      getCategories(),
      each(getTimeBlocksBetween),
      each(getActualLogsBetween),
      viewMonday === thisMonday ? null : getWeeklyGoalsOfWeek(thisMonday),
    ])
      .then(([d, w, u, c, b, actual, thisWeek]) => {
        setThisWeekHasWeekly((thisWeek ?? w).length > 0)
        setActuals(actual)
        setWeekGoals(d)
        setWeeklyGoals(w)
        setUnfinished(u)
        setCategories(c)
        setBlocks(b)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [today, thisMonday, sunday, viewMonday])

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

  const goals = weekGoals.filter((g) => g.date === today)
  const pullCount = unfinished.length
  const changeView = (v: 'day' | 'week') => {
    setView(v)
    try {
      localStorage.setItem('today.view', v)
    } catch {
      // 저장 못 해도 화면은 그대로 쓸 수 있다
    }
  }


  return (
    <section className="today-page">
      <div className="page-head">
        <h1>
          일정 <span className="page-date muted">{dayLabel(today)}</span>
        </h1>
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
        hasWeeklyGoals={thisWeekHasWeekly}
      />

      <div
        className={wideSchedule ? 'today-layout schedule-only' : 'today-layout'}
        style={{ '--left-w': `${leftWidth}px` } as CSSProperties}
      >
        <div className="card today-list">
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
          />
          {isToday && (
          <PullSection
            today={today}
            unfinished={unfinished}
            run={run}
          />
          )}
        </div>
        <div
          className="layout-splitter"
          role="separator"
          aria-orientation="vertical"
          aria-label="목록 폭 조절"
          title="끌어서 목록 폭을 바꿔요 (두 번 누르면 기본값)"
          onPointerDown={startResize}
          onDoubleClick={() => saveLeftWidth(DEFAULT_LEFT_WIDTH)}
        />
        <div className="card schedule-card">
          {/* Google Calendar처럼 왼쪽에 [오늘] ‹ › 기간 제목, 오른쪽에 [일|주]와 넓게 보기(1-4f ⑫) */}
          <div className="cal-header">
            <span className="cal-nav">
              <button className="ghost" onClick={() => setSelected(today)} disabled={view === 'week' ? viewMonday === thisMonday : isToday}>
                오늘
              </button>
              <button
                className="icon"
                onClick={() => setSelected(shiftDate(selected, view === 'week' ? -7 : -1))}
                aria-label={view === 'week' ? '지난주' : '전날'}
                title={view === 'week' ? '지난주' : '전날'}
              >
                ‹
              </button>
              <button
                className="icon"
                onClick={() => setSelected(shiftDate(selected, view === 'week' ? 7 : 1))}
                aria-label={view === 'week' ? '다음 주' : '다음 날'}
                title={view === 'week' ? '다음 주' : '다음 날'}
              >
                ›
              </button>
              <h3 className="cal-title">{view === 'week' ? weekTitle(viewMonday) : dayLabel(selected)}</h3>
            </span>
            <span className="cal-tools">
              <span className="segmented">
                {(['day', 'week'] as const).map((v) => (
                  <button key={v} className={view === v ? 'active' : ''} onClick={() => changeView(v)}>
                    {v === 'day' ? '일' : '주'}
                  </button>
                ))}
              </span>
              <button
                className="icon wide-toggle"
                onClick={toggleWide}
                aria-pressed={wideSchedule}
                aria-label={wideSchedule ? '목록 보기' : '넓게 보기'}
                title={wideSchedule ? '목록 다시 보기' : '목록을 접고 시간표만 넓게 보기'}
              >
                {wideSchedule ? '⤡' : '⤢'}
              </button>
            </span>
          </div>
          {wideSchedule && (
            <div className="schedule-toolbar">
              <div className="toolbar-add">
                <NewDailyGoalForm
                  key={selected}
                  date={selected}
                  weeklyGoals={weeklyGoals ?? []}
                  categories={categories}
                  onSubmit={(input) => run(() => createDailyGoal(input))}
                />
              </div>
              {isToday && pullCount > 0 && (
                <span className="toolbar-pull">
                  <button className="ghost" onClick={() => setPullOpen(!pullOpen)} aria-expanded={pullOpen}>
                    가져올 것 {pullCount}
                  </button>
                  {pullOpen && (
                    <div className="card toolbar-pull-panel">
                      <PullSection
                        today={today}
                        unfinished={unfinished}
                        run={run}
                      />
                    </div>
                  )}
                </span>
              )}
              {isToday && <Workload blocks={blocks.filter((b) => b.date === today)} goals={goals} compact />}
            </div>
          )}
          <SidebarTip />
          <p className="muted small schedule-help">
            빈 칸을 끌어 시간을 잡고, 블록을 끌어 옮기거나 아래 끝을 끌어 늘여요. {wideSchedule ? '위쪽 목표 칩을' : '왼쪽 목표를'} 끌어다 놓아도 돼요.
          </p>
          <ScheduleView
            dates={view === 'day' ? [selected] : weekDates(viewMonday)}
            blocks={blocks}
            goals={weekGoals}
            run={run}
            selectedDate={selected}
            onSelectDate={setSelected}
            actuals={actuals}
            categories={categories}
          />
        </div>
      </div>

      {shutdown && (
        <DayWrapUp
          date={today}
          onClose={() => {
            setShutdown(false)
            load()
          }}
        />
      )}

      <ServerAlert />
    </section>
  )
}

/** 지금 걸친 시간 블록, 없으면 다음 블록을 한 줄로 알려준다(Structured의 지금/다음 강조 참고) */

/**
 * 알림 한 칸(docs/design.md 6장 1-4d): 주간 목표 없음 > 월요일 계획하기.
 * 금~일 돌아보기와 21시 이후 하루 마무리는 오른쪽 위 알림 카드(ReminderStack, 1-4f ⑬)로 옮겼다.
 */
function AlertSlot({
  today,
  monday,
  hasWeeklyGoals,
}: {
  today: string
  monday: string
  hasWeeklyGoals: boolean | null
}) {
  const [planDismissed, setPlanDismissed] = useState(() => {
    try {
      return localStorage.getItem(plannedKey(monday)) === '1'
    } catch {
      return false
    }
  })
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

/** 오늘 시간 잡은 양과 남은 시간(지금~자정). 남은 일정이 남은 시간보다 많으면 경고(Sunsama의 과부하 경고 참고) */
function Workload({ blocks, goals, compact = false }: { blocks: TimeBlock[]; goals: DailyGoal[]; compact?: boolean }) {
  const today = todaySeoul()
  const now = nowMinutesSeoul()
  const spans = blocks.map((b) => ({ start: minutesOfDay(b.startAt, today), end: minutesOfDay(b.endAt, today), goalId: b.dailyGoalId }))
  const planned = spans.reduce((sum, x) => sum + x.end - x.start, 0)
  const ahead = spans.reduce((sum, x) => sum + Math.max(0, x.end - Math.max(x.start, now)), 0)
  const left = Math.max(0, 1440 - now)
  const unscheduled = goals.filter((g) => g.status === 'TODO' && !spans.some((x) => x.goalId === g.id))
  const over = ahead > left
  const hm = (m: number) => formatDuration(m * 60)

  // 평소에는 계획 합계만, 남은 계획이 오늘 남은 시간보다 많을 때만 경고(Sunsama 과다 계획 경고 방식)
  return (
    <div className={[compact ? 'toolbar-workload' : 'workload', over ? 'over' : 'muted', 'small'].join(' ')}>
      {over ? (
        <span>
          ⚠ 남은 계획 <strong>{hm(ahead)}</strong>이 오늘 남은 시간({hm(left)})보다 많아요. 내일로 넘길 것을 골라요.
        </span>
      ) : (
        <span>
          계획 <strong>{hm(planned)}</strong>
          {unscheduled.length > 0 && (
            <span title={unscheduled.map((g) => g.content).join('\n')}> · 시간 안 잡음 {unscheduled.length}</span>
          )}
        </span>
      )}
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

/** "10월 26일 – 11월 1일", 같은 달이면 "10월 19일 – 25일" */
const weekTitle = (monday: string) => {
  const sunday = shiftDate(monday, 6)
  const md = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일`
  return sunday.slice(5, 7) === monday.slice(5, 7) ? `${md(monday)} – ${Number(sunday.slice(8))}일` : `${md(monday)} – ${md(sunday)}`
}

const LEFT_WIDTH_KEY = 'today.leftWidth'
const WIDE_KEY = 'today.wideSchedule'
const DEFAULT_LEFT_WIDTH = 380
const MIN_LEFT_WIDTH = 300
const MAX_LEFT_WIDTH = 560
const SIDEBAR_TIP_KEY = 'today.sidebarTipSeen'

const readNumber = (key: string, fallback: number) => {
  try {
    const v = Number(localStorage.getItem(key))
    return Number.isFinite(v) && v > 0 ? v : fallback
  } catch {
    return fallback
  }
}

const writeValue = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // 저장 못 해도 지금 화면은 바뀐다
  }
}

/** 메뉴가 펼쳐져 있으면 '메뉴를 접으면 더 넓어져요'를 한 번 알려준다 */
function SidebarTip() {
  const [show, setShow] = useState(() => {
    try {
      return localStorage.getItem('layout.sidebar.collapsed') !== '1' && localStorage.getItem(SIDEBAR_TIP_KEY) !== '1'
    } catch {
      return false
    }
  })
  if (!show) return null
  const close = () => {
    writeValue(SIDEBAR_TIP_KEY, '1')
    setShow(false)
  }
  return (
    <p className="notice small sidebar-tip">
      왼쪽 메뉴를 접으면 시간표가 더 넓어져요.
      <button
        className="ghost"
        onClick={() => {
          window.dispatchEvent(new Event(COLLAPSE_EVENT))
          close()
        }}
      >
        메뉴 접기
      </button>
      <button className="icon" onClick={close} aria-label="다시 보지 않기">
        ×
      </button>
    </p>
  )
}
