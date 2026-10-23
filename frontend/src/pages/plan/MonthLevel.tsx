import { useCallback, useEffect, useState } from 'react'
import type { Category } from '../../api/categories'
import { errorMessage } from '../../api/client'
import { getDailyGoalsBetween, type DailyGoal } from '../../api/dailyGoals'
import {
  createMonthlyGoal,
  deleteMonthlyGoal,
  toMonthlyInput,
  toWeeklyInput,
  updateMonthlyGoal,
  updateWeeklyGoal,
  type Goal,
} from '../../api/goals'
import { getMonthlyReview, type MonthlyReview } from '../../api/reviews'
import { MonthlyGoalForm } from '../../components/GoalTree'
import MoreMenu from '../../components/MoreMenu'
import { addMonths, mondayOf, mondaysOfMonth, monthLabel, shiftDate, todaySeoul } from '../../utils/date'
import { HEALTH_LABELS, healthOf, monthRange } from '../../utils/health'
import { activeGoal, allMonthlyGoals, monthlyPercent, weeklyGoalsOf, type Run } from './planData'

type Props = {
  month: string
  goals: Goal[]
  categories: Category[]
  run: Run
  onOpenWeek: (monday: string) => void
  onOpenGoalLevel: () => void
}

/** "10/19–25", 달이 바뀌면 "10/26–11/1" */
const weekRangeLabel = (monday: string) => {
  const sunday = shiftDate(monday, 6)
  const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`
  return sunday.slice(5, 7) === monday.slice(5, 7) ? `${md(monday)}–${Number(sunday.slice(8))}` : `${md(monday)}–${md(sunday)}`
}

/**
 * [월](docs/design.md 1-4f ⑨, Linear 사이클 요약·Notion 월간 템플릿 참고):
 * 이 달 목표 → 주차별 주간 목표와 할 일(⑳: 숫자는 대시보드, 월간 회고는 기록 페이지)
 */
export default function MonthLevel({ month, goals, run: parentRun, onOpenWeek, onOpenGoalLevel }: Props) {
  const [lastReview, setLastReview] = useState<MonthlyReview | null>(null)
  const [dailyGoals, setDailyGoals] = useState<DailyGoal[]>([])
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const today = todaySeoul()
  const { from, to } = monthRange(month)
  const mondays = mondaysOfMonth(month)

  const load = useCallback(() => {
    const weeks = mondaysOfMonth(month)
    Promise.all([
      getMonthlyReview(addMonths(month, -1)),
      getDailyGoalsBetween(weeks[0], shiftDate(weeks[weeks.length - 1], 6)),
    ])
      .then(([last, d]) => {
        setLastReview(last)
        setDailyGoals(d)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [month])

  useEffect(load, [load])

  const run: Run = (action) => parentRun(action).finally(load)
  const monthlyGoals = allMonthlyGoals(goals).filter((m) => m.month === month)
  const goal = activeGoal(goals)

  return (
    <div className="month-page">
      {error && <p className="error">{error}</p>}

      <div className="card">
        <div className="goal-header">
          <h3 className="timeline-title">이 달 목표</h3>
          {goal && !adding && (
            <button className="ghost" onClick={() => setAdding(true)}>
              + 월간 목표
            </button>
          )}
        </div>
        {lastReview?.nextDirection && <p className="muted small">📌 지난달에 정한 방향: {lastReview.nextDirection}</p>}
        {monthlyGoals.length === 0 && !adding && (
          <div className="empty-cta">
            <p className="muted small">이 달에 이룰 한두 가지를 정해요.</p>
            {goal ? (
              <button onClick={() => setAdding(true)}>{monthLabel(month).slice(6)} 월간 목표 만들기</button>
            ) : (
              <button onClick={onOpenGoalLevel}>최종 목표부터 만들기</button>
            )}
          </div>
        )}
        {adding && goal && (
          <MonthlyGoalForm
            goal={goal}
            defaultMonth={month}
            submitLabel="추가"
            onSubmit={(input) => run(() => createMonthlyGoal(goal.id, input)).then((ok) => ok && setAdding(false))}
            onCancel={() => setAdding(false)}
          />
        )}
        <ul className="month-goal-list">
          {monthlyGoals.map((m) => {
            if (editingId === m.id) {
              return (
                <li key={m.id}>
                  <MonthlyGoalForm
                    goal={goals.find((g) => g.id === m.goalId)!}
                    initial={m}
                    submitLabel="저장"
                    onSubmit={(input) => run(() => updateMonthlyGoal(m.id, input)).then((ok) => ok && setEditingId(null))}
                    onCancel={() => setEditingId(null)}
                  />
                </li>
              )
            }
            const percent = monthlyPercent(m)
            const health = healthOf(percent, from, to, today, m.achieved)
            return (
              <li key={m.id} className="month-goal-row">
                <span className={m.achieved ? 'done' : undefined}>{m.content}</span>
                <span className="goal-bar">
                  <span className="goal-bar-fill" style={{ width: `${percent}%` }} />
                </span>
                <span className="muted small">
                  주간 목표 {m.progress.achieved}/{m.progress.total}
                </span>
                <span className={`status-chip health-${health}`}>{HEALTH_LABELS[health]}</span>
                <MoreMenu
                  label="월간 목표 동작"
                  items={[
                    {
                      label: m.achieved ? '달성 취소' : '달성',
                      onClick: () => run(() => updateMonthlyGoal(m.id, { ...toMonthlyInput(m), achieved: !m.achieved })),
                    },
                    { label: '수정', onClick: () => setEditingId(m.id) },
                    {
                      label: '삭제',
                      danger: true,
                      onClick: () => confirm(`'${m.content}' 월간 목표를 삭제할까요?`) && run(() => deleteMonthlyGoal(m.id)),
                    },
                  ]}
                />
              </li>
            )
          })}
        </ul>
      </div>

      <div className="card">
        <h3 className="timeline-title">주차별</h3>
        <div className="month-week-table" role="table" aria-label="주차별 요약">
          <div className="month-week-row head muted small" role="row">
            <span>주</span>
            <span>주간 목표</span>
            <span>할 일</span>
          </div>
          {mondays.map((monday) => {
            const weekly = weeklyGoalsOf(goals, monday)
            const days = dailyGoals.filter((d) => mondayOf(d.date) === monday)
            return (
              <div key={monday} className={monday === mondayOf(today) ? 'month-week-row current' : 'month-week-row'} role="row">
                <button className="ghost month-week-label" onClick={() => onOpenWeek(monday)} title="이 주 보기">
                  {weekRangeLabel(monday)} ›
                </button>
                <span className="month-week-goals">
                  {weekly.length === 0 && <span className="muted">–</span>}
                  {weekly.map((wg) => (
                    <label key={wg.id} className="month-week-goal">
                      <input
                        type="checkbox"
                        checked={wg.achieved}
                        onChange={() => run(() => updateWeeklyGoal(wg.id, { ...toWeeklyInput(wg), achieved: !wg.achieved }))}
                        aria-label="달성"
                      />
                      <span className={wg.achieved ? 'done' : undefined}>{wg.content}</span>
                    </label>
                  ))}
                </span>
                <span className="small">
                  {days.length ? `${days.filter((d) => d.status === 'DONE').length}/${days.length}` : '–'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
