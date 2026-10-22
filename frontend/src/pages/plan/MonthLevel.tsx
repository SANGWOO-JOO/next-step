import { useCallback, useEffect, useState } from 'react'
import type { Category } from '../../api/categories'
import { errorMessage } from '../../api/client'
import { getDailyGoalsBetween, type DailyGoal } from '../../api/dailyGoals'
import { formatDuration } from '../../api/focus'
import { toMonthlyInput, toWeeklyInput, updateMonthlyGoal, updateWeeklyGoal, createWeeklyGoal, type Goal } from '../../api/goals'
import { getMonthlyReview, saveMonthlyReview, studySeconds, type MonthlyReview } from '../../api/reviews'
import GoalCalendar from '../../components/GoalCalendar'
import HealthDot from '../../components/HealthDot'
import ProgressBar from '../../components/ProgressBar'
import ReviewFields from '../../components/ReviewFields'
import { addMonths, mondaysOfMonth, monthLabel, shiftDate, todaySeoul } from '../../utils/date'
import { healthOf, monthRange } from '../../utils/health'
import { allMonthlyGoals, monthlyPercent, type Run } from './planData'

type Props = {
  month: string
  goals: Goal[]
  categories: Category[]
  run: Run
  onOpenWeek: (monday: string) => void
  onOpenGoalLevel: () => void
}

/** [월]: 월간 목표 카드와 주차 줄(가운데) + 이 달 숫자, 지난달 반영, 월간 회고(오른쪽) */
export default function MonthLevel({ month, goals, categories, run: parentRun, onOpenWeek, onOpenGoalLevel }: Props) {
  const [review, setReview] = useState<MonthlyReview | null>(null)
  const [lastReview, setLastReview] = useState<MonthlyReview | null>(null)
  const [dailyGoals, setDailyGoals] = useState<DailyGoal[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const today = todaySeoul()
  const { from, to } = monthRange(month)

  const load = useCallback(() => {
    const mondays = mondaysOfMonth(month)
    Promise.all([
      getMonthlyReview(month),
      getMonthlyReview(addMonths(month, -1)),
      getDailyGoalsBetween(mondays[0], shiftDate(mondays[mondays.length - 1], 6)),
    ])
      .then(([r, last, d]) => {
        setReview(r)
        setLastReview(last)
        setDailyGoals(d)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [month])

  useEffect(load, [load])

  const run: Run = (action) => parentRun(action).finally(load)
  const monthlyGoals = allMonthlyGoals(goals).filter((m) => m.month === month)
  const totals = review?.weeks.reduce(
    (sum, w) => ({ study: sum.study + studySeconds(w), done: sum.done + w.goalsDone, all: sum.all + w.goalsTotal }),
    { study: 0, done: 0, all: 0 },
  )

  return (
    <>
      {error && <p className="error">{error}</p>}
      <div className="plan-layout">
        <div className="plan-main">
          <div className="card">
            <div className="goal-header">
              <h2 className="goal-title">{monthLabel(month)} 월간 목표</h2>
              <button className="ghost" onClick={onOpenGoalLevel}>
                월간 목표 추가·수정은 [최종]에서 ›
              </button>
            </div>
            {monthlyGoals.length === 0 ? (
              <p className="muted small">이 달의 월간 목표가 없어요.</p>
            ) : (
              <ul className="monthly-cards">
                {monthlyGoals.map((m) => (
                  <li key={m.id} className="monthly-card">
                    <span className="inline-form monthly-card-head">
                      <input
                        type="checkbox"
                        checked={m.achieved}
                        onChange={() => run(() => updateMonthlyGoal(m.id, { ...toMonthlyInput(m), achieved: !m.achieved }))}
                        aria-label="달성"
                      />
                      <HealthDot health={healthOf(monthlyPercent(m), from, to, today, m.achieved)} label />
                      <strong className={m.achieved ? 'done' : undefined}>{m.content}</strong>
                    </span>
                    <span className="monthly-card-metrics">
                      <span className="muted small">주간 목표</span>
                      <ProgressBar progress={m.progress} />
                      {m.targetValue !== null && (
                        <span className="small">
                          <span className="muted">수치 </span>
                          {m.currentValue ?? 0}/{m.targetValue}
                          {m.unit ?? ''}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <h3 className="timeline-title">주차별 주간 목표</h3>
            <p className="muted small">날짜를 누르면 그날 하루 목표를, '주 보기'를 누르면 그 주 계획을 열어요.</p>
            <GoalCalendar
              embedded
              goals={goals}
              categories={categories}
              month={month}
              onMonthChange={() => undefined}
              onToggleMonthly={() => undefined}
              onToggleWeekly={(w) => run(() => updateWeeklyGoal(w.id, { ...toWeeklyInput(w), achieved: !w.achieved }))}
              onAddWeekly={(monthlyGoalId, input) => run(() => createWeeklyGoal(monthlyGoalId, input))}
              dailyGoals={dailyGoals}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              run={run}
              onOpenWeek={onOpenWeek}
            />
          </div>
        </div>

        <aside className="plan-side">
          {lastReview?.nextDirection && (
            <div className="card pinned">
              <span className="muted small">📌 지난달 회고의 "다음 달 방향"</span>
              <p className="pinned-text">{lastReview.nextDirection}</p>
            </div>
          )}
          {review && totals && (
            <div className="card">
              <h3 className="timeline-title">이 달 숫자</h3>
              <dl className="result-stats">
                <dt>공부</dt>
                <dd>{formatDuration(totals.study)}</dd>
                <dt>하루 목표</dt>
                <dd>
                  {totals.done}/{totals.all} 완료
                </dd>
                <dt>일지 쓴 주</dt>
                <dd>
                  {review.weeks.filter((w) => w.journalWritten).length}/{review.weeks.length}
                </dd>
              </dl>
              <ul className="week-bars">
                {review.weeks.map((w) => {
                  const max = Math.max(1, ...review.weeks.map(studySeconds))
                  return (
                    <li key={w.weekStart}>
                      <button className="ghost small" onClick={() => onOpenWeek(w.weekStart)}>
                        {Number(w.weekStart.slice(5, 7))}/{Number(w.weekStart.slice(8))}
                      </button>
                      <span className="week-bar-track">
                        <span className="week-bar-fill" style={{ width: `${(studySeconds(w) / max) * 100}%` }} />
                      </span>
                      <span className="small">{studySeconds(w) > 0 ? formatDuration(studySeconds(w)) : '-'}</span>
                      <span title="일지">{w.journalWritten ? '✓' : ''}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          {review && (
            <div className="card">
              <h3 className="timeline-title">월간 회고</h3>
              <ReviewFields
                fields={[
                  { key: 'review', label: '회고', placeholder: '이번 달에 무엇을 했고 어땠나요?', rows: 5 },
                  { key: 'nextDirection', label: '다음 달 방향', placeholder: '다음 달에 집중할 것' },
                ]}
                values={{ review: review.review, nextDirection: review.nextDirection }}
                version={`${month}|${review.updatedAt}`}
                aiSummary={review.aiSummary}
                onSave={(v) => run(() => saveMonthlyReview(month, { review: v.review, nextDirection: v.nextDirection }))}
              />
            </div>
          )}
        </aside>
      </div>
    </>
  )
}
