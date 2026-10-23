import { useCallback, useEffect, useState } from 'react'
import type { Category } from '../../api/categories'
import { errorMessage } from '../../api/client'
import { getDailyGoalsBetween, type DailyGoal } from '../../api/dailyGoals'
import { formatDuration } from '../../api/focus'
import {
  createMonthlyGoal,
  deleteMonthlyGoal,
  toMonthlyInput,
  toWeeklyInput,
  updateMonthlyGoal,
  updateWeeklyGoal,
  type Goal,
} from '../../api/goals'
import {
  getMonthlyReview,
  getWeeklyJournals,
  saveMonthlyReview,
  studySeconds,
  type MonthlyReview,
  type WeeklyJournalBrief,
} from '../../api/reviews'
import { MonthlyGoalForm } from '../../components/GoalTree'
import MoreMenu from '../../components/MoreMenu'
import HealthDot from '../../components/HealthDot'
import ProgressBar from '../../components/ProgressBar'
import ReviewCard from '../../components/ReviewCard'
import { addMonths, mondayOf, mondaysOfMonth, monthLabel, shiftDate, todaySeoul, weekLabel } from '../../utils/date'
import { healthOf, monthRange } from '../../utils/health'
import { activeGoal, allMonthlyGoals, monthlyPercent, reviewDue, weeklyGoalsOf, type Run } from './planData'

type Props = {
  month: string
  goals: Goal[]
  categories: Category[]
  run: Run
  onOpenWeek: (monday: string) => void
  onOpenGoalLevel: () => void
}

/** [월]: 월간 목표 카드와 주차 줄(가운데) + 이 달 숫자, 지난달 반영, 월간 회고(오른쪽) */
export default function MonthLevel({ month, goals, run: parentRun, onOpenWeek, onOpenGoalLevel }: Props) {
  const [review, setReview] = useState<MonthlyReview | null>(null)
  const [lastReview, setLastReview] = useState<MonthlyReview | null>(null)
  const [dailyGoals, setDailyGoals] = useState<DailyGoal[]>([])
  const [journals, setJournals] = useState<WeeklyJournalBrief[]>([])
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const today = todaySeoul()
  const { from, to } = monthRange(month)

  const load = useCallback(() => {
    const mondays = mondaysOfMonth(month)
    Promise.all([
      getMonthlyReview(month),
      getMonthlyReview(addMonths(month, -1)),
      getDailyGoalsBetween(mondays[0], shiftDate(mondays[mondays.length - 1], 6)),
      getWeeklyJournals(mondays[0], mondays[mondays.length - 1]),
    ])
      .then(([r, last, d, j]) => {
        setJournals(j)
        setReview(r)
        setLastReview(last)
        setDailyGoals(d)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [month])

  useEffect(load, [load])

  const run: Run = (action) => parentRun(action).finally(load)
  const monthlyGoals = allMonthlyGoals(goals).filter((m) => m.month === month)
  const goal = activeGoal(goals)
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
              {goal && !adding && (
                <button className="ghost" onClick={() => setAdding(true)}>
                  + 월간 목표
                </button>
              )}
            </div>
            {monthlyGoals.length === 0 && !adding && (
              <div className="empty-cta">
                <p className="muted small">이 달의 월간 목표가 없어요. 이 달에 이룰 한두 가지를 정해요.</p>
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
            {monthlyGoals.length > 0 && (
              <ul className="monthly-cards">
                {monthlyGoals.map((m) =>
                  editingId === m.id ? (
                    <li key={m.id} className="monthly-card">
                      <MonthlyGoalForm
                        goal={goals.find((g) => g.id === m.goalId)!}
                        initial={m}
                        submitLabel="저장"
                        onSubmit={(input) => run(() => updateMonthlyGoal(m.id, input)).then((ok) => ok && setEditingId(null))}
                        onCancel={() => setEditingId(null)}
                      />
                    </li>
                  ) : (
                    <li key={m.id} className="monthly-card">
                      <span className="inline-form monthly-card-head">
                        <input
                          type="checkbox"
                          checked={m.achieved}
                          onChange={() => run(() => updateMonthlyGoal(m.id, { ...toMonthlyInput(m), achieved: !m.achieved }))}
                          aria-label="달성"
                        />
                        <HealthDot health={healthOf(monthlyPercent(m), from, to, today, m.achieved)} />
                        <strong className={m.achieved ? 'done' : undefined}>{m.content}</strong>
                        <MoreMenu
                          label="월간 목표 동작"
                          items={[
                            { label: '수정', onClick: () => setEditingId(m.id) },
                            {
                              label: '삭제',
                              danger: true,
                              onClick: () =>
                                confirm(`'${m.content}' 월간 목표를 삭제할까요?`) && run(() => deleteMonthlyGoal(m.id)),
                            },
                          ]}
                        />
                      </span>
                      <span className="monthly-card-metrics">
                        <span className="muted small">주간 목표</span>
                        <ProgressBar progress={m.progress} />
                      </span>
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>

          <div className="card">
            <h3 className="timeline-title">주차별 주간 목표</h3>
            <ul className="month-weeks">
              {mondaysOfMonth(month).map((monday) => {
                const weekly = weeklyGoalsOf(goals, monday)
                const days = dailyGoals.filter((d) => mondayOf(d.date) === monday)
                return (
                  <li key={monday} className={monday === mondayOf(today) ? 'current' : undefined}>
                    <button className="ghost month-week-label" onClick={() => onOpenWeek(monday)} title="이 주 보기">
                      {Number(monday.slice(5, 7))}/{Number(monday.slice(8))} 주 ›
                    </button>
                    <span className="month-week-goals">
                      {weekly.length === 0 && <span className="muted small">주간 목표 없음</span>}
                      {weekly.map((w) => (
                        <label key={w.id} className="month-week-goal">
                          <input
                            type="checkbox"
                            checked={w.achieved}
                            onChange={() => run(() => updateWeeklyGoal(w.id, { ...toWeeklyInput(w), achieved: !w.achieved }))}
                            aria-label="달성"
                          />
                          <span className={w.achieved ? 'done' : undefined}>{w.content}</span>
                        </label>
                      ))}
                    </span>
                    {days.length > 0 && (
                      <span className="muted small" title="이 주 할 일 완료/전체">
                        할 일 {days.filter((d) => d.status === 'DONE').length}/{days.length}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
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
                      <span className="small">{formatDuration(studySeconds(w))}</span>
                      <span title="일지">{w.journalWritten ? '✓' : ''}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          {review && (
            <ReviewCard
              key={`${month}|${review.saved}`}
              title="월간 회고"
              fields={[
                { key: 'review', label: '회고', placeholder: '이번 달에 무엇을 했고 어땠나요?', rows: 5 },
                { key: 'nextDirection', label: '다음 달 방향', placeholder: '다음 달에 집중할 것' },
              ]}
              values={{ review: review.review, nextDirection: review.nextDirection }}
              version={`${month}|${review.updatedAt}`}
              aiSummary={review.aiSummary}
              saved={review.saved}
              due={reviewDue(month, today)}
              prompt={month === today.slice(0, 7) ? '이 달의 마지막 주예요. 한 달을 돌아보고 다음 달 방향을 정해요.' : undefined}
              onSave={(v) => run(() => saveMonthlyReview(month, { review: v.review, nextDirection: v.nextDirection }))}
            />
          )}
          {journals.length > 0 && (
            <div className="card">
              <h3 className="timeline-title">이 달 주간 일지 모음</h3>
              <ul className="review-list">
                {journals.map((j) => (
                  <li key={j.weekStart}>
                    <button className="ghost" onClick={() => onOpenWeek(j.weekStart)}>
                      {weekLabel(j.weekStart)}
                    </button>
                    {j.good && <p className="small">잘한 점: {j.good}</p>}
                    {j.bad && <p className="small">아쉬운 점: {j.bad}</p>}
                    {j.nextAction && <p className="small muted">→ 다음 주: {j.nextAction}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </>
  )
}
