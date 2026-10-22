import { useCallback, useEffect, useState } from 'react'
import type { Category } from '../../api/categories'
import { errorMessage } from '../../api/client'
import { getDailyGoalsBetween, type DailyGoal } from '../../api/dailyGoals'
import type { Goal } from '../../api/goals'
import { getWeeklyJournal, saveWeeklyJournal, type WeeklyJournal } from '../../api/reviews'
import { getWeeklyPlans, type WeeklyPlan } from '../../api/weeklyPlans'
import { DayColumn, WeekGoalList, WeekSummary } from '../../components/plan/WeekParts'
import ReviewCard from '../../components/ReviewCard'
import { mondayOf, shiftDate, todaySeoul, weekDates } from '../../utils/date'
import WeeklyPlanningWizard from './WeeklyPlanningWizard'
import { journalDue, monthlyGoalsOfWeek, weeklyGoalsOf, type Run } from './planData'

type Props = { monday: string; goals: Goal[]; categories: Category[]; run: Run }

/** [주]: 주간 목표, 요일별 계획(가운데) + 요일별 기록, 지난주 반영, 주간 일지(오른쪽) */
export default function WeekLevel({ monday, goals, categories, run: parentRun }: Props) {
  const [plans, setPlans] = useState<WeeklyPlan[]>([])
  const [dailyGoals, setDailyGoals] = useState<DailyGoal[]>([])
  const [journal, setJournal] = useState<WeeklyJournal | null>(null)
  const [lastJournal, setLastJournal] = useState<WeeklyJournal | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [wizard, setWizard] = useState(false)
  const dates = weekDates(monday)
  const today = todaySeoul()

  const load = useCallback(() => {
    Promise.all([
      getWeeklyPlans(monday),
      getDailyGoalsBetween(monday, shiftDate(monday, 6)),
      getWeeklyJournal(monday),
      getWeeklyJournal(shiftDate(monday, -7)),
    ])
      .then(([p, d, j, last]) => {
        setPlans(p)
        setDailyGoals(d)
        setJournal(j)
        setLastJournal(last)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [monday])

  useEffect(load, [load])

  // 목표 트리(부모)와 이 주의 데이터를 함께 다시 불러온다
  const run: Run = (action) => parentRun(action).finally(load)

  const weeklyGoals = weeklyGoalsOf(goals, monday)

  return (
    <>
      {error && <p className="error">{error}</p>}
      <div className="plan-layout">
        <div className="plan-main">
          <div className="card">
            <div className="goal-header">
              <h2 className="goal-title">주간 목표</h2>
              <button onClick={() => setWizard(true)}>{monday > today ? '다음 주 미리 계획하기' : '이번 주 계획하기'} ▶</button>
            </div>
            <WeekGoalList
              monday={monday}
              weeklyGoals={weeklyGoals}
              monthlyGoals={monthlyGoalsOfWeek(goals, monday)}
              dailyGoals={dailyGoals}
              categories={categories}
              run={run}
            />
          </div>
          <div className="week-grid">
            {dates.map((date) => (
              <DayColumn
                key={date}
                date={date}
                today={date === today}
                plans={plans.filter((p) => p.date === date)}
                dailyGoals={dailyGoals.filter((d) => d.date === date)}
                weeklyGoals={weeklyGoals}
                weekDates={dates}
                run={run}
              />
            ))}
          </div>
        </div>

        <aside className="plan-side">
          {lastJournal?.nextAction && (
            <div className="card pinned">
              <span className="muted small">📌 지난주 일지의 "다음 주 반영"</span>
              <p className="pinned-text">{lastJournal.nextAction}</p>
            </div>
          )}
          {journal && <WeekSummary journal={journal} />}
          {journal && (
            <ReviewCard
              key={`${monday}|${journal.saved}`}
              title="주간 일지"
              fields={[
                { key: 'good', label: '잘한 점', placeholder: '이번 주에 잘된 것' },
                { key: 'bad', label: '아쉬운 점', placeholder: '막혔던 것, 딴짓한 때' },
                { key: 'nextAction', label: '다음 주 반영', placeholder: '다음 주에 바꿀 한 가지' },
              ]}
              values={{ good: journal.good, bad: journal.bad, nextAction: journal.nextAction }}
              version={`${monday}|${journal.updatedAt}`}
              aiSummary={journal.aiSummary}
              saved={journal.saved}
              due={journalDue(monday, today)}
              prompt={monday === mondayOf(today) ? '한 주를 마무리할 때예요. 돌아보고 다음 주에 바꿀 한 가지를 정해요.' : undefined}
              onSave={(v) => run(() => saveWeeklyJournal(monday, { good: v.good, bad: v.bad, nextAction: v.nextAction }))}
            />
          )}
        </aside>
      </div>

      {wizard && (
        <WeeklyPlanningWizard
          monday={monday}
          goals={goals}
          categories={categories}
          plans={plans}
          dailyGoals={dailyGoals}
          lastJournal={lastJournal}
          run={run}
          onClose={() => setWizard(false)}
        />
      )}
    </>
  )
}
