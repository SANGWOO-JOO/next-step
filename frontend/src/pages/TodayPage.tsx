import { useCallback, useEffect, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getCategories, type Category } from '../api/categories'
import { errorMessage } from '../api/client'
import { createDailyGoal, getDailyGoalsBetween, getUnfinishedDailyGoals, type DailyGoal } from '../api/dailyGoals'
import { getWeekPlan } from '../api/goals'
import { formatDuration } from '../api/focus'
import { getHealth } from '../api/health'
import { getActualLogsBetween, type ActualLog } from '../api/actualLogs'
import { getTimeBlocksBetween, type TimeBlock } from '../api/timeBlocks'
import DayTaskColumn from '../components/today/DayTaskColumn'
import DailyGoalPanel, { NewDailyGoalForm } from '../components/DailyGoalPanel'
import PullSection from '../components/today/PullSection'
import DayWrapUp from '../components/today/DayWrapUp'
import { COLLAPSE_EVENT } from '../components/Layout'
import ScheduleView, { type Lanes } from '../components/ScheduleView'
import chevronLeft from '../assets/icons/chevron-left.svg'
import chevronRight from '../assets/icons/chevron-right.svg'
import clockIcon from '../assets/icons/clock.svg'
import fitDayOnIcon from '../assets/icons/fit-day-on.svg'
import fitDayIcon from '../assets/icons/fit-day.svg'
import narrowIcon from '../assets/icons/narrow.svg'
import wideIcon from '../assets/icons/wide.svg'
import IconButton from '../components/IconButton'
import pullIcon from '../assets/icons/pull.svg'
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
  /** 진행 중 목표가 있는지. 목표 시간은 선택이라 보지 않는다(2-2 추가 결정 ③). 알림 칸용 */
  const [thisWeekHasPlan, setThisWeekHasPlan] = useState<boolean | null>(null)
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
  // ?date=로 들어오면 그 날(주)을 연다(시작 설정을 마친 직후 등)
  const [selected, setSelected] = useState(() => searchParams.get('date') ?? today)
  // 화면이 뜬 뒤에 주소가 바뀌어도 따라가고, 적용한 date는 주소에서 지운다
  useEffect(() => {
    const date = searchParams.get('date')
    if (!date) return
    setSelected(date)
    const next = new URLSearchParams(searchParams)
    next.delete('date')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])
  /** 24시간 한눈에(1-4f ㉕). 켠 상태를 기억한다 */
  const [fitDay, setFitDay] = useState(() => {
    try {
      return localStorage.getItem(FIT_DAY_KEY) === '1'
    } catch {
      return false
    }
  })
  /** 계획만 / 실제만 / 둘 다 중 하나를 고른다(1-4f ㉗·㊼). 기억한다 */
  const [lanes, setLanes] = useState<Lanes>(() => {
    try {
      const v = localStorage.getItem(LANES_KEY)
      return v === 'plan' || v === 'actual' ? v : 'both'
    } catch {
      return 'both'
    }
  })
  const chooseLanes = (next: Lanes) => {
    setLanes(next)
    writeValue(LANES_KEY, next)
  }
  const toggleFitDay = () => {
    setFitDay(!fitDay)
    writeValue(FIT_DAY_KEY, fitDay ? '0' : '1')
  }
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
      getUnfinishedDailyGoals(today),
      getCategories(),
      each(getTimeBlocksBetween),
      each(getActualLogsBetween),
      getWeekPlan(thisMonday),
    ])
      .then(([d, u, c, b, actual, plan]) => {
        setThisWeekHasPlan(plan.goals.some((r) => r.goal.status === 'ACTIVE'))
        setActuals(actual)
        setWeekGoals(d)
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
      {/* 제목은 메뉴(일정)와 시간표 기간 제목과 겹쳐서 화면에서는 숨긴다(1-4f ㉝) */}
      <h1 className="sr-only">일정 · {dayLabel(today)}</h1>
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
        hasWeekPlan={thisWeekHasPlan}
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
              <IconButton
                icon={chevronLeft}
                label={view === 'week' ? '지난주' : '전날'}
                onClick={() => setSelected(shiftDate(selected, view === 'week' ? -7 : -1))}
              />
              <IconButton
                icon={chevronRight}
                label={view === 'week' ? '다음 주' : '다음 날'}
                onClick={() => setSelected(shiftDate(selected, view === 'week' ? 7 : 1))}
              />
              <h3 className="cal-title">{view === 'week' ? weekTitle(viewMonday) : dayLabel(selected)}</h3>
            </span>
            <span className="cal-tools">
              {/* 보기 줄 아이콘 세 칸(1-4f ㊼): 고른 칸만 칠해져 지금 상태가 늘 보인다. 이름은 툴팁으로 */}
              <span className="segmented lane-switch" role="radiogroup" aria-label="보기 줄">
                {(['plan', 'actual', 'both'] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    role="radio"
                    aria-checked={lanes === l}
                    aria-label={LANE_LABELS[l]}
                    data-tip={LANE_LABELS[l]}
                    className={lanes === l ? 'active' : ''}
                    onClick={() => chooseLanes(l)}
                  >
                    <LaneGlyph lanes={l} />
                  </button>
                ))}
              </span>
              <IconButton
                icon={fitDay ? fitDayOnIcon : fitDayIcon}
                label="24시간 한눈에"
                title={fitDay ? '24시간 한눈에 끄기: 시간표를 원래 크기로' : '24시간 한눈에: 0시~24시를 스크롤 없이 한 화면에'}
                onClick={toggleFitDay}
                on={fitDay}
                pressed={fitDay}
              />
              <span className="segmented">
                {(['day', 'week'] as const).map((v) => (
                  <button key={v} className={view === v ? 'active' : ''} onClick={() => changeView(v)}>
                    {v === 'day' ? '일' : '주'}
                  </button>
                ))}
              </span>
              <IconButton
                icon={wideSchedule ? narrowIcon : wideIcon}
                label={wideSchedule ? '목록 보기' : '넓게 보기'}
                title={wideSchedule ? '목록 다시 보기' : '넓게 보기: 목록을 접고 시간표만'}
                tipAlign="right"
                onClick={toggleWide}
                on={wideSchedule}
                pressed={wideSchedule}
              />
            </span>
          </div>
          {/* 넓게 보기 위 줄은 지난 할 일 버튼만. 추가는 [일] 카드 열 아래, [주] 날짜 칸 ⊕(1-4f ㊹·㊿) */}
          {wideSchedule && isToday && pullCount > 0 && (
            <div className="schedule-toolbar">
              {isToday && pullCount > 0 && (
                <span className="toolbar-pull">
                  <button
                    className={pullOpen ? 'icon-only pull-toggle on' : 'icon-only pull-toggle'}
                    onClick={() => setPullOpen(!pullOpen)}
                    aria-expanded={pullOpen}
                    aria-label={`지난 할 일 ${pullCount}개`}
                    title={`지난 할 일 ${pullCount}개: 눌러서 오늘로 가져오기`}
                  >
                    <img src={pullIcon} alt="" aria-hidden="true" width={26} height={26} draggable={false} />
                    <span className="icon-badge">{pullCount}</span>
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
            </div>
          )}
          <SidebarTip />
          {/* 사용법 안내는 이 기간에 블록이 하나도 없을 때(처음 쓸 때)만 */}
          {!blocks.some((b) => (view === 'day' ? b.date === selected : weekDates(viewMonday).includes(b.date))) && (
            <p className="muted small schedule-help">
              빈 칸을 끌어 시간을 잡고, 블록을 끌어 옮기거나 아래 끝을 끌어 늘여요. {view === 'week' && wideSchedule ? '위쪽 할 일 칩을' : '왼쪽 할 일을'} 끌어다 놓아도 돼요.
            </p>
          )}
          <div className={wideSchedule && view === 'day' ? 'day-split' : 'day-split off'}>
            {wideSchedule && view === 'day' && (
              <DayTaskColumn
                date={selected}
                goals={weekGoals.filter((g) => g.date === selected)}
                blocks={blocks.filter((b) => b.date === selected)}
                run={run}
                addForm={
                  <NewDailyGoalForm
                    key={selected}
                    date={selected}
                    categories={categories}
                    onSubmit={(input) => run(() => createDailyGoal(input))}
                  />
                }
              />
            )}
            <ScheduleView
              dates={view === 'day' ? [selected] : weekDates(viewMonday)}
              blocks={blocks}
              goals={weekGoals}
              run={run}
              selectedDate={selected}
              onSelectDate={setSelected}
              actuals={actuals}
              categories={categories}
              fitDay={fitDay}
              lanes={lanes}
              renderAdd={(date, close) => (
                <NewDailyGoalForm
                  date={date}
                  categories={categories}
                  placeholder={`목표 찾기 · ${dayLabel(date).replace(/^\d+월 /, '')}`}
                  autoFocus
                  onDone={close}
                  onSubmit={(input) => run(() => createDailyGoal(input))}
                />
              )}
            />
          </div>
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
 * 알림 한 칸(docs/design.md 6장 1-4d): 진행 중 목표 없음 > 월요일 계획하기.
 * 금~일 돌아보기와 21시 이후 하루 마무리는 오른쪽 위 알림 카드(ReminderStack, 1-4f ⑬)로 옮겼다.
 */
function AlertSlot({
  today,
  monday,
  hasWeekPlan,
}: {
  today: string
  monday: string
  hasWeekPlan: boolean | null
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

  if (hasWeekPlan === null) return null
  const planLink = `/goals?week=${monday}`
  let alert: { text: string; action: ReactNode; onClose?: () => void } | null = null
  if (!hasWeekPlan) {
    alert = { text: '집중할 목표를 정해 볼까요?', action: <Link className="button-link" to={planLink}>목표 정하기 ▶</Link> }
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

  // 도구 줄에는 계획 합계, 목록 패널에는 넘칠 때 경고만(1-4f ㉞). Sunsama 과다 계획 경고 방식
  if (!compact && !over) return null
  return (
    <div className={[compact ? 'toolbar-workload' : 'workload', over ? 'over' : 'muted', 'small'].join(' ')}>
      {over ? (
        <span>
          ⚠ 남은 계획 <strong>{hm(ahead)}</strong>이 오늘 남은 시간({hm(left)})보다 많아요. 내일로 넘길 것을 골라요.
        </span>
      ) : (
        <span className="workload-line" title="오늘 계획한 시간">
          <img className="inline-icon" src={clockIcon} alt="계획" width={26} height={26} draggable={false} />
          <strong>{hm(planned)}</strong>
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
const FIT_DAY_KEY = 'today.fitDay'
const LANES_KEY = 'today.lanes'
const LANE_LABELS: Record<Lanes, string> = { both: '계획·실제 둘 다', plan: '계획만', actual: '실제만' }

/** 하루 칸을 두 줄로 그리고 보이는 줄을 칠한다: 왼쪽 = 계획, 오른쪽 = 실제 */
function LaneGlyph({ lanes }: { lanes: Lanes }) {
  const left = lanes !== 'actual'
  const right = lanes !== 'plan'
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
      <rect x="2.5" y="3" width="6" height="12" rx="2" fill={left ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4" />
      <rect x="9.5" y="3" width="6" height="12" rx="2" fill={right ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}
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
