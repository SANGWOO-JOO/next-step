import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { formatDuration } from '../api/focus'
import { getMonthlyGoalsOfMonth, type MonthlyGoal } from '../api/goals'
import { getMonthlyReview, saveMonthlyReview, studySeconds, type MonthlyReview } from '../api/reviews'
import CategoryBadge from '../components/CategoryBadge'
import ProgressBar from '../components/ProgressBar'
import ReviewFields from '../components/ReviewFields'
import { addMonths, currentMonthSeoul, mondayOf, monthLabel, todaySeoul, weekLabel } from '../utils/date'

/** 월간 목표 진행률, 주차별 현황, 월간 회고 */
export default function MonthlyPage() {
  const [month, setMonth] = useState(currentMonthSeoul())
  const [goals, setGoals] = useState<MonthlyGoal[]>([])
  const [review, setReview] = useState<MonthlyReview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const thisMonday = mondayOf(todaySeoul())

  const load = useCallback(() => {
    Promise.all([getMonthlyGoalsOfMonth(month), getMonthlyReview(month)])
      .then(([g, r]) => {
        setGoals(g)
        setReview(r)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [month])

  useEffect(load, [load])

  const save = async (v: Record<string, string | null>) => {
    setError(null)
    try {
      setReview(await saveMonthlyReview(month, { review: v.review, nextDirection: v.nextDirection }))
      return true
    } catch (e) {
      setError(errorMessage(e))
      return false
    }
  }

  const total = review?.weeks.reduce(
    (sum, w) => ({
      study: sum.study + studySeconds(w),
      distraction: sum.distraction + w.distractionSeconds,
      done: sum.done + w.goalsDone,
      all: sum.all + w.goalsTotal,
    }),
    { study: 0, distraction: 0, done: 0, all: 0 },
  )

  return (
    <section>
      <div className="calendar-nav">
        <button className="icon" onClick={() => setMonth(addMonths(month, -1))} aria-label="지난 달">
          ‹
        </button>
        <h1 className="week-title">{monthLabel(month)}</h1>
        <button className="icon" onClick={() => setMonth(addMonths(month, 1))} aria-label="다음 달">
          ›
        </button>
        {month !== currentMonthSeoul() && (
          <button className="ghost" onClick={() => setMonth(currentMonthSeoul())}>
            이번 달
          </button>
        )}
      </div>
      {error && (
        <p className="error-banner" role="alert">
          {error}
          <button className="icon" onClick={() => setError(null)} aria-label="닫기">
            ×
          </button>
        </p>
      )}

      <div className="card">
        <h2>월간 목표</h2>
        {goals.length === 0 ? (
          <p className="muted small">
            이 달의 월간 목표가 없어요. <Link to="/goals">최종 목표</Link>에서 만들어 주세요.
          </p>
        ) : (
          <ul className="calendar-monthly">
            {goals.map((g) => (
              <li key={g.id}>
                <span className={g.achieved ? 'done' : undefined}>{g.content}</span>
                {g.targetValue !== null && (
                  <span className="muted small">
                    {g.currentValue ?? 0}/{g.targetValue}
                    {g.unit ?? ''}
                  </span>
                )}
                <ProgressBar progress={g.progress} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {review && total && (
        <div className="card">
          <h2>주차별 현황</h2>
          <p className="muted small">
            이 달 공부 {formatDuration(total.study)} · 딴짓 {formatDuration(total.distraction)} · 하루 목표{' '}
            {total.done}/{total.all} 완료
          </p>
          <div className="table-scroll">
            <table className="month-weeks">
              <thead>
                <tr>
                  <th>주</th>
                  <th>주간 목표</th>
                  <th>공부</th>
                  <th>딴짓</th>
                  <th>하루 목표</th>
                  <th>일지</th>
                </tr>
              </thead>
              <tbody>
                {review.weeks.map((w) => {
                  const weeklyGoals = goals.flatMap((g) => g.weeklyGoals).filter((wg) => wg.weekStart === w.weekStart)
                  return (
                    <tr key={w.weekStart} className={w.weekStart === thisMonday ? 'current' : undefined}>
                      <td>{weekLabel(w.weekStart)}</td>
                      <td>
                        <span className="row-actions">
                          {weeklyGoals.length === 0 && <span className="muted">-</span>}
                          {weeklyGoals.map((wg) =>
                            wg.category ? (
                              <CategoryBadge
                                key={wg.id}
                                name={`${wg.achieved ? '✓ ' : ''}${wg.content}`}
                                color={wg.category.color}
                              />
                            ) : (
                              <span key={wg.id} className="badge">
                                {wg.achieved ? '✓ ' : ''}
                                {wg.content}
                              </span>
                            ),
                          )}
                        </span>
                      </td>
                      <td>{studySeconds(w) > 0 ? formatDuration(studySeconds(w)) : '-'}</td>
                      <td>{w.distractionSeconds > 0 ? formatDuration(w.distractionSeconds) : '-'}</td>
                      <td>
                        {w.goalsDone}/{w.goalsTotal}
                      </td>
                      <td>{w.journalWritten ? '✓' : <span className="muted">-</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="small">
            <Link to="/weekly">주간 화면</Link>에서 주간 일지를 쓸 수 있어요.
          </p>
        </div>
      )}

      {review && (
        <div className="card">
          <h2>월간 회고</h2>
          <ReviewFields
            fields={[
              { key: 'review', label: '회고', placeholder: '이번 달에 무엇을 했고 어땠나요?', rows: 5 },
              { key: 'nextDirection', label: '다음 달 방향', placeholder: '다음 달에 집중할 것' },
            ]}
            values={{ review: review.review, nextDirection: review.nextDirection }}
            version={`${month}|${review.updatedAt}`}
            aiSummary={review.aiSummary}
            onSave={save}
          />
        </div>
      )}
    </section>
  )
}
