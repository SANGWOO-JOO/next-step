import { useCallback, useEffect, useState } from 'react'
import type { Category } from '../../api/categories'
import { errorMessage } from '../../api/client'
import { getDailyGoalsBetween, moveDailyGoal, type DailyGoal } from '../../api/dailyGoals'
import { formatDuration } from '../../api/focus'
import type { Goal } from '../../api/goals'
import { getWeeklyJournal, saveWeeklyJournal, studySeconds, type WeeklyJournal } from '../../api/reviews'
import { DayColumn, WeekGoalChips } from '../../components/plan/WeekParts'
import { refreshReminders } from '../../utils/reminders'
import ReviewCard from '../../components/ReviewCard'
import { mondayOf, shiftDate, todaySeoul, weekDates } from '../../utils/date'
import WeeklyPlanningWizard from './WeeklyPlanningWizard'
import { journalDue, monthlyGoalsOfWeek, weeklyGoalsOf, type Run } from './planData'

type Props = { monday: string; goals: Goal[]; categories: Category[]; run: Run }

/** [주](docs/design.md 1-4f ⑩): 숫자 요약 → 이번 주 목표 → 요일별 할 일(그날 공부 시간 포함) → 주간 일지 */
export default function WeekLevel({ monday, goals, categories, run: parentRun }: Props) {
  const [dailyGoals, setDailyGoals] = useState<DailyGoal[]>([])
  const [journal, setJournal] = useState<WeeklyJournal | null>(null)
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
      getWeeklyJournal(monday),
      getWeeklyJournal(shiftDate(monday, -7)),
    ])
      .then(([d, j, last]) => {
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

  // 같은 주 안으로 옮기면 주간 목표 연결은 그대로다
  const moveGoal = (goalId: number, date: string) => {
    const goal = dailyGoals.find((g) => g.id === goalId)
    if (!goal || goal.date === date) return
    run(() => moveDailyGoal(goalId, date))
  }

  const days = journal?.days ?? []
  const maxStudy = Math.max(1, ...days.map((d) => studySeconds(d.summary)))
  const total = journal?.total

  return (
    <div className="week-page">
      {error && <p className="error">{error}</p>}

      <div className="month-metrics">
        <Metric label="공부" value={total ? formatDuration(studySeconds(total)) : '–'} />
        <Metric label="할 일 완료" value={total ? `${total.goalsDone}/${total.goalsTotal}` : '–'} />
        <Metric label="주간 목표" value={total ? `${total.weeklyGoalsAchieved}/${total.weeklyGoalsTotal}` : '–'} />
        <Metric label="딴짓" value={total ? formatDuration(total.distractionSeconds) : '–'} />
      </div>

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
          {dates.map((date, i) => (
            <DayColumn
              key={date}
              date={date}
              today={date === today}
              dailyGoals={dailyGoals.filter((d) => d.date === date)}
              weeklyGoals={weeklyGoals}
              run={run}
              highlightGoalId={highlight}
              onDropGoal={moveGoal}
              study={days[i] ? { seconds: studySeconds(days[i].summary), max: maxStudy } : undefined}
            />
          ))}
        </div>
      </div>

      {journal && (
        <div className="week-journal" id="journal">
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
            onSave={(v) =>
              run(() => saveWeeklyJournal(monday, { good: v.good, bad: v.bad, nextAction: v.nextAction })).then((ok) => {
                refreshReminders()
                return ok
              })
            }
          />
        </div>
      )}

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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="goal-metric">
      <span className="muted small">{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
