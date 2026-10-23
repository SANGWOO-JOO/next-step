import { useCallback, useEffect, useState } from 'react'
import type { Category } from '../../api/categories'
import { errorMessage } from '../../api/client'
import { getDailyGoalsBetween, moveDailyGoal, type DailyGoal } from '../../api/dailyGoals'
import type { Goal } from '../../api/goals'
import { getWeeklyJournal, type WeeklyJournal } from '../../api/reviews'
import { DayColumn, WeekGoalChips } from '../../components/plan/WeekParts'
import { shiftDate, todaySeoul, weekDates } from '../../utils/date'
import WeeklyPlanningWizard from './WeeklyPlanningWizard'
import { monthlyGoalsOfWeek, weeklyGoalsOf, type Run } from './planData'

type Props = { monday: string; goals: Goal[]; categories: Category[]; run: Run }

/** [주](docs/design.md 1-4f ⑩·⑳): 이번 주 목표 → 요일별 할 일. 숫자는 대시보드, 주간 일지는 기록 페이지 */
export default function WeekLevel({ monday, goals, categories, run: parentRun }: Props) {
  const [dailyGoals, setDailyGoals] = useState<DailyGoal[]>([])
  const [lastJournal, setLastJournal] = useState<WeeklyJournal | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [wizard, setWizard] = useState(false)
  /** 칩에서 고른 주간 목표. 그 목표의 계획만 강조한다 */
  const [highlight, setHighlight] = useState<number | null>(null)
  const dates = weekDates(monday)
  const today = todaySeoul()

  const load = useCallback(() => {
    Promise.all([
      getDailyGoalsBetween(monday, shiftDate(monday, 6)),
      getWeeklyJournal(shiftDate(monday, -7)),
    ])
      .then(([d, last]) => {
        setDailyGoals(d)
        setLastJournal(last)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [monday])

  useEffect(load, [load])

  // 목표 트리(부모)와 이 주의 데이터를 함께 다시 불러온다
  const run: Run = (action) => parentRun(action).finally(load)

  const weeklyGoals = weeklyGoalsOf(goals, monday)

  // 같은 주 안으로 옮기면 주간 목표 연결은 그대로다
  const moveGoal = (goalId: number, date: string) => {
    const goal = dailyGoals.find((g) => g.id === goalId)
    if (!goal || goal.date === date) return
    run(() => moveDailyGoal(goalId, date))
  }

  return (
    <div className="week-page">
      {error && <p className="error">{error}</p>}

      <div className="card week-goals-card">
        <div className="goal-header">
          <h3 className="timeline-title">이번 주 목표</h3>
          <button className="ghost" onClick={() => setWizard(true)}>
            {monday > today ? '다음 주 미리 계획하기' : '이번 주 계획하기'} ›
          </button>
        </div>
        <WeekGoalChips
          monday={monday}
          weeklyGoals={weeklyGoals}
          monthlyGoals={monthlyGoalsOfWeek(goals, monday)}
          dailyGoals={dailyGoals}
          categories={categories}
          run={run}
          selectedId={highlight}
          onSelect={setHighlight}
        />
        {lastJournal?.nextAction && <p className="muted small">📌 지난주에 정한 한 가지: {lastJournal.nextAction}</p>}
      </div>

      <div className="card">
        <div className="goal-header">
          <h3 className="timeline-title">요일별 할 일</h3>
          <span className="muted small">카드를 끌어 다른 요일로 옮겨요</span>
        </div>
        <div className="week-board">
          {dates.map((date) => (
            <DayColumn
              key={date}
              date={date}
              today={date === today}
              dailyGoals={dailyGoals.filter((d) => d.date === date)}
              weeklyGoals={weeklyGoals}
              run={run}
              highlightGoalId={highlight}
              onDropGoal={moveGoal}
            />
          ))}
        </div>
      </div>

      {wizard && (
        <WeeklyPlanningWizard
          monday={monday}
          goals={goals}
          categories={categories}
          dailyGoals={dailyGoals}
          lastJournal={lastJournal}
          run={run}
          onClose={() => setWizard(false)}
        />
      )}
    </div>
  )
}
