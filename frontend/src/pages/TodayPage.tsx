import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCategories, type Category } from '../api/categories'
import { errorMessage } from '../api/client'
import {
  getDailyGoals,
  getUnfinishedDailyGoals,
  moveDailyGoal,
  type DailyGoal,
} from '../api/dailyGoals'
import { getWeeklyGoalsOfWeek, type WeeklyGoal } from '../api/goals'
import { getHealth, type Health } from '../api/health'
import CategoryBadge from '../components/CategoryBadge'
import DailyGoalPanel from '../components/DailyGoalPanel'
import { dayLabel, mondayOf, todaySeoul } from '../utils/date'

export default function TodayPage() {
  const today = todaySeoul()
  const thisMonday = mondayOf(today)
  const [goals, setGoals] = useState<DailyGoal[]>([])
  const [weeklyGoals, setWeeklyGoals] = useState<WeeklyGoal[]>([])
  const [unfinished, setUnfinished] = useState<DailyGoal[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    Promise.all([getDailyGoals(today), getWeeklyGoalsOfWeek(thisMonday), getUnfinishedDailyGoals(today), getCategories()])
      .then(([d, w, u, c]) => {
        setGoals(d)
        setWeeklyGoals(w)
        setUnfinished(u)
        setCategories(c)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [today, thisMonday])

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

  return (
    <section>
      <h1>오늘</h1>
      <p className="muted">{dayLabel(today)} · 핵심 3개부터 시작해요. 시작 버튼과 시간 블록은 1-2b에서 들어와요.</p>
      {error && (
        <p className="error-banner" role="alert">
          {error}
          <button className="icon" onClick={() => setError(null)} aria-label="닫기">
            ×
          </button>
        </p>
      )}

      {unfinished.length > 0 && (
        <UnfinishedCard goals={unfinished} today={today} weeklyGoals={weeklyGoals} run={run} />
      )}

      <div className="card">
        <DailyGoalPanel
          key={today}
          date={today}
          title="오늘 할 일"
          goals={goals}
          weeklyGoals={weeklyGoals}
          categories={categories}
          run={run}
        />
        {weeklyGoals.length === 0 && (
          <p className="small">
            <Link to="/goals?view=calendar">최종 목표 캘린더</Link>에서 이번 주 주간 목표를 먼저 만들어 주세요.
          </p>
        )}
      </div>

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
