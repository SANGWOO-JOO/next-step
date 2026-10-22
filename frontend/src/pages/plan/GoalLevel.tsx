import { useEffect, useState } from 'react'
import type { Category } from '../../api/categories'
import type { Goal } from '../../api/goals'
import { getMonthlyReviews, type MonthlyReviewBrief } from '../../api/reviews'
import GoalTree from '../../components/GoalTree'
import HealthDot from '../../components/HealthDot'
import ProgressBar from '../../components/ProgressBar'
import { addMonths, currentMonthSeoul, monthLabel, todaySeoul } from '../../utils/date'
import { elapsedPercent, healthOf, monthRange } from '../../utils/health'
import { monthlyPercent, type Run } from './planData'

/** 로드맵에 기본으로 보여줄 달 수 */
const ROADMAP_WINDOW = 7

type Props = { goals: Goal[]; categories: Category[]; run: Run; onOpenMonth: (month: string) => void }

/** 최종 목표 기간의 달 목록 */
function monthsOf(goal: Goal) {
  const months: string[] = []
  for (let m = goal.startDate.slice(0, 7); m <= goal.targetDate.slice(0, 7); m = addMonths(m, 1)) months.push(m)
  return months
}

/** [최종]: 월 단위 로드맵(가운데 위) + 목표 트리 편집(가운데 아래) + 월간 회고 목록(오른쪽) */
export default function GoalLevel({ goals, categories, run, onOpenMonth }: Props) {
  const [reviews, setReviews] = useState<MonthlyReviewBrief[]>([])
  const [showAll, setShowAll] = useState(false)
  const today = todaySeoul()
  const shown = goals.filter((g) => g.status === 'ACTIVE')
  const span = shown.length
    ? { from: shown.map((g) => g.startDate.slice(0, 7)).sort()[0], to: shown.map((g) => g.targetDate.slice(0, 7)).sort().reverse()[0] }
    : null

  useEffect(() => {
    if (!span) return
    getMonthlyReviews(span.from, span.to)
      .then(setReviews)
      .catch(() => setReviews([]))
  }, [span?.from, span?.to]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="plan-layout">
      <div className="plan-main">
        {shown.map((goal) => {
          // 기간이 길면 지난달부터 ROADMAP_WINDOW개월만 보여주고 나머지는 접는다
          const allMonths = monthsOf(goal)
          const startAt = Math.max(0, allMonths.indexOf(addMonths(currentMonthSeoul(), -1)))
          const months = showAll ? allMonths : allMonths.slice(startAt, startAt + ROADMAP_WINDOW)
          const hidden = allMonths.length - months.length
          return (
            <div key={goal.id} className="card">
              <div className="goal-header">
                <HealthDot health={healthOf(goal.progress.percent, goal.startDate, goal.targetDate, today)} label />
                <h2 className="goal-title">{goal.title}</h2>
                <span className="muted small">
                  {goal.startDate} ~ {goal.targetDate} · 기간 {elapsedPercent(goal.startDate, goal.targetDate, today)}% 지남
                </span>
                <span className="muted small">월간 목표</span>
                <ProgressBar progress={goal.progress} />
              </div>
              <div className="roadmap" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(7.5rem, 1fr))` }}>
                {months.map((month) => {
                  const monthly = goal.monthlyGoals.filter((m) => m.month === month)
                  const { from, to } = monthRange(month)
                  return (
                    <button
                      key={month}
                      type="button"
                      className={month === currentMonthSeoul() ? 'roadmap-month current' : 'roadmap-month'}
                      onClick={() => onOpenMonth(month)}
                    >
                      <span className="roadmap-label">
                        {monthLabel(month).slice(6)}
                        {month === currentMonthSeoul() && <span className="roadmap-now">지금</span>}
                      </span>
                      {monthly.length === 0 && <span className="muted small">월간 목표 없음</span>}
                      {monthly.map((m) => (
                        <span key={m.id} className="roadmap-item">
                          <HealthDot health={healthOf(monthlyPercent(m), from, to, today, m.achieved)} />
                          <span className={m.achieved ? 'done' : undefined}>{m.content}</span>
                          <span className="muted small">
                            주간 {m.progress.achieved}/{m.progress.total}
                          </span>
                        </span>
                      ))}
                    </button>
                  )
                })}
              </div>
              {(hidden > 0 || showAll) && allMonths.length > ROADMAP_WINDOW && (
                <button className="ghost add" onClick={() => setShowAll(!showAll)}>
                  {showAll ? '지금 주변만 보기' : `나머지 ${hidden}개월도 보기`}
                </button>
              )}
            </div>
          )
        })}
        <h3 className="timeline-title plan-subtitle">목표 편집</h3>
        <GoalTree goals={goals} categories={categories} run={run} />
      </div>

      <aside className="plan-side">
        <div className="card">
          <h3 className="timeline-title">월간 회고 모음</h3>
          {reviews.length === 0 ? (
            <p className="muted small">아직 쓴 월간 회고가 없어요. [월] 보기에서 쓸 수 있어요.</p>
          ) : (
            <ul className="review-list">
              {reviews.map((r) => (
                <li key={r.month}>
                  <button className="ghost" onClick={() => onOpenMonth(r.month)}>
                    {monthLabel(r.month)}
                  </button>
                  {r.review && <p className="small">{r.review}</p>}
                  {r.nextDirection && <p className="small muted">→ 다음 달: {r.nextDirection}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  )
}
