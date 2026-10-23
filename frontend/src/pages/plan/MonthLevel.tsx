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
import { getMonthlyReview, saveMonthlyReview, studySeconds, type MonthlyReview } from '../../api/reviews'
import { getStatsSummary, type StatsSummary } from '../../api/stats'
import { MonthlyGoalForm } from '../../components/GoalTree'
import MoreMenu from '../../components/MoreMenu'
import ReviewCard from '../../components/ReviewCard'
import { addMonths, mondayOf, mondaysOfMonth, monthLabel, shiftDate, todaySeoul } from '../../utils/date'
import { HEALTH_LABELS, healthOf, monthRange } from '../../utils/health'
import { activeGoal, allMonthlyGoals, monthlyPercent, reviewDue, weeklyGoalsOf, type Run } from './planData'

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
 * 숫자 요약 4칸 → 이 달 목표 → 주차별 표(주 한 줄에 목표·공부·할 일·일지) → 월간 회고
 */
export default function MonthLevel({ month, goals, run: parentRun, onOpenWeek, onOpenGoalLevel }: Props) {
  const [review, setReview] = useState<MonthlyReview | null>(null)
  const [lastReview, setLastReview] = useState<MonthlyReview | null>(null)
  const [dailyGoals, setDailyGoals] = useState<DailyGoal[]>([])
  const [stats, setStats] = useState<StatsSummary | null>(null)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const today = todaySeoul()
  const { from, to } = monthRange(month)
  const mondays = mondaysOfMonth(month)

  const load = useCallback(() => {
    const weeks = mondaysOfMonth(month)
    Promise.all([
      getMonthlyReview(month),
      getMonthlyReview(addMonths(month, -1)),
      getDailyGoalsBetween(weeks[0], shiftDate(weeks[weeks.length - 1], 6)),
      getStatsSummary(weeks[0], shiftDate(weeks[weeks.length - 1], 6)),
    ])
      .then(([r, last, d, s]) => {
        setReview(r)
        setLastReview(last)
        setDailyGoals(d)
        setStats(s)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [month])

  useEffect(load, [load])

  const run: Run = (action) => parentRun(action).finally(load)
  const monthlyGoals = allMonthlyGoals(goals).filter((m) => m.month === month)
  const goal = activeGoal(goals)
  const weeks = review?.weeks ?? []
  const maxStudy = Math.max(1, ...weeks.map(studySeconds))
  const doneAll = weeks.reduce((sum, w) => ({ done: sum.done + w.goalsDone, all: sum.all + w.goalsTotal }), { done: 0, all: 0 })

  return (
    <div className="month-page">
      {error && <p className="error">{error}</p>}

      <div className="month-metrics">
        <Metric label="공부" value={stats ? formatDuration(stats.totalSeconds) : '–'} />
        <Metric label="공부한 날" value={stats ? `${stats.studyDays}일` : '–'} />
        <Metric label="할 일 완료" value={`${doneAll.done}/${doneAll.all}`} />
        <Metric label="일지 쓴 주" value={`${weeks.filter((w) => w.journalWritten).length}/${weeks.length}`} />
      </div>

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
            <span>공부</span>
            <span>할 일</span>
            <span>일지</span>
          </div>
          {mondays.map((monday) => {
            const weekly = weeklyGoalsOf(goals, monday)
            const days = dailyGoals.filter((d) => mondayOf(d.date) === monday)
            const w = weeks.find((x) => x.weekStart === monday)
            const seconds = w ? studySeconds(w) : 0
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
                <span className="month-week-study">
                  {seconds > 0 && (
                    <span className="goal-bar">
                      <span className="goal-bar-fill accent" style={{ width: `${(seconds / maxStudy) * 100}%` }} />
                    </span>
                  )}
                  <span className="small">{formatDuration(seconds)}</span>
                </span>
                <span className="small">
                  {days.length ? `${days.filter((d) => d.status === 'DONE').length}/${days.length}` : '–'}
                </span>
                <span className="small" title="주간 일지">
                  {w?.journalWritten ? '✓' : '–'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {review && (
        <ReviewCard
          key={`${month}|${review.saved}`}
          title="월간 회고"
          fields={[
            { key: 'review', label: '회고', placeholder: '이번 달에 무엇을 했고 어땠나요?', rows: 4 },
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
