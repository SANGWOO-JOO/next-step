import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { getDailyGoalsBetween, type DailyGoal } from '../api/dailyGoals'
import { getWeeklyGoalsOfWeek, type WeeklyGoal } from '../api/goals'
import { formatDuration } from '../api/focus'
import { CONDITION_LABELS } from '../api/records'
import { getWeeklyJournal, saveWeeklyJournal, studySeconds, type WeeklyJournal } from '../api/reviews'
import { createWeeklyPlan, getWeeklyPlans, type WeeklyPlan } from '../api/weeklyPlans'
import CategoryBadge from '../components/CategoryBadge'
import ReviewFields from '../components/ReviewFields'
import WeeklyPlanItem from '../components/WeeklyPlanItem'
import { dayLabel, mondayOf, shiftDate, todaySeoul, weekDates, weekLabel } from '../utils/date'

/** 이번 주 주간 목표와 요일별 계획. 주를 앞뒤로 옮겨 볼 수 있다. */
export default function WeeklyPage() {
  const today = todaySeoul()
  const [monday, setMonday] = useState(mondayOf(today))
  const [weeklyGoals, setWeeklyGoals] = useState<WeeklyGoal[]>([])
  const [plans, setPlans] = useState<WeeklyPlan[]>([])
  const [dailyGoals, setDailyGoals] = useState<DailyGoal[]>([])
  const [journal, setJournal] = useState<WeeklyJournal | null>(null)
  const [error, setError] = useState<string | null>(null)
  const dates = weekDates(monday)

  const load = useCallback(() => {
    Promise.all([
      getWeeklyGoalsOfWeek(monday),
      getWeeklyPlans(monday),
      getDailyGoalsBetween(monday, shiftDate(monday, 6)),
      getWeeklyJournal(monday),
    ])
      .then(([w, p, d, j]) => {
        setJournal(j)
        setWeeklyGoals(w)
        setPlans(p)
        setDailyGoals(d)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [monday])

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
      <div className="calendar-nav">
        <button className="icon" onClick={() => setMonday(shiftDate(monday, -7))} aria-label="지난 주">
          ‹
        </button>
        <h1 className="week-title">{weekLabel(monday)}</h1>
        <button className="icon" onClick={() => setMonday(shiftDate(monday, 7))} aria-label="다음 주">
          ›
        </button>
        {monday !== mondayOf(today) && (
          <button className="ghost" onClick={() => setMonday(mondayOf(today))}>
            이번 주
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
        <h2>주간 목표</h2>
        {weeklyGoals.length === 0 ? (
          <p className="muted small">
            이 주의 주간 목표가 없어요. <Link to="/goals?view=calendar">최종 목표 캘린더</Link>에서 먼저 만들어 주세요.
          </p>
        ) : (
          <ul className="unfinished-list">
            {weeklyGoals.map((w) => {
              const linked = dailyGoals.filter((d) => d.weeklyGoalId === w.id)
              return (
                <li key={w.id}>
                  <span className={w.achieved ? 'done' : undefined}>{w.content}</span>
                  {w.category && <CategoryBadge name={w.category.name} color={w.category.color} />}
                  <span className="muted small">
                    하루 목표 {linked.filter((d) => d.status === 'DONE').length}/{linked.length} 완료 · 계획{' '}
                    {plans.filter((p) => p.weeklyGoalId === w.id).length}개
                  </span>
                </li>
              )
            })}
          </ul>
        )}
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

      {journal && (
        <div className="today-grid">
          <div className="card">
            <h2>주간 일지</h2>
            <ReviewFields
              fields={[
                { key: 'good', label: '잘한 점', placeholder: '이번 주에 잘된 것' },
                { key: 'bad', label: '아쉬운 점', placeholder: '막혔던 것, 딴짓한 때' },
                { key: 'nextAction', label: '다음 주 반영', placeholder: '다음 주에 바꿀 한 가지' },
              ]}
              values={{ good: journal.good, bad: journal.bad, nextAction: journal.nextAction }}
              version={`${monday}|${journal.updatedAt}`}
              aiSummary={journal.aiSummary}
              onSave={(v) =>
                run(() =>
                  saveWeeklyJournal(monday, { good: v.good, bad: v.bad, nextAction: v.nextAction }),
                )
              }
            />
          </div>
          <WeekSummary journal={journal} />
        </div>
      )}
    </section>
  )
}

type DayProps = {
  date: string
  today: boolean
  plans: WeeklyPlan[]
  dailyGoals: DailyGoal[]
  weeklyGoals: WeeklyGoal[]
  weekDates: string[]
  run: (action: () => Promise<unknown>) => Promise<boolean>
}

function DayColumn({ date, today, plans, dailyGoals, weeklyGoals, weekDates, run }: DayProps) {
  const [adding, setAdding] = useState(false)
  const [content, setContent] = useState('')
  const [pickedId, setPickedId] = useState<number | null>(null)
  const weeklyGoalId = weeklyGoals.find((w) => w.id === pickedId)?.id ?? weeklyGoals[0]?.id

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!weeklyGoalId) return
    run(() => createWeeklyPlan({ weeklyGoalId, date, content })).then((ok) => {
      if (ok) {
        setContent('')
        setAdding(false)
      }
    })
  }

  return (
    <div className={today ? 'card day-column today' : 'card day-column'}>
      <div className="daily-panel-head">
        <strong>{dayLabel(date).replace(/^\d+월 /, '')}</strong>
        <span className="muted small">
          하루 목표 {dailyGoals.filter((d) => d.status === 'DONE').length}/{dailyGoals.length}
        </span>
      </div>
      <ul className="plan-list">
        {plans.map((p) => (
          <WeeklyPlanItem
            key={p.id}
            plan={p}
            hasDailyGoal={dailyGoals.some((d) => d.content === p.content)}
            run={run}
            weekDates={weekDates}
          />
        ))}
      </ul>
      {adding ? (
        <form className="stack-form" onSubmit={submit}>
          {weeklyGoals.length > 1 && (
            <select value={weeklyGoalId} onChange={(e) => setPickedId(Number(e.target.value))} aria-label="주간 목표">
              {weeklyGoals.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.content}
                </option>
              ))}
            </select>
          )}
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="할 일"
            required
            maxLength={500}
            autoFocus
          />
          <span className="row-actions">
            <button type="submit">추가</button>
            <button type="button" className="ghost" onClick={() => setAdding(false)}>
              취소
            </button>
          </span>
        </form>
      ) : (
        <button className="ghost add" disabled={weeklyGoals.length === 0} onClick={() => setAdding(true)}>
          + 계획
        </button>
      )}
    </div>
  )
}

/** 이번 주 요일별 공부 시간, 목표 완료, 컨디션 */
function WeekSummary({ journal }: { journal: WeeklyJournal }) {
  const t = journal.total
  const max = Math.max(1, ...journal.days.map((d) => studySeconds(d.summary)))
  return (
    <div className="card">
      <h3 className="timeline-title">이번 주 요약</h3>
      <dl className="result-stats">
        <dt>공부 합계</dt>
        <dd>{formatDuration(studySeconds(t))}</dd>
        <dt>딴짓</dt>
        <dd>{formatDuration(t.distractionSeconds)}</dd>
        <dt>하루 목표</dt>
        <dd>
          {t.goalsDone}/{t.goalsTotal} 완료
        </dd>
        <dt>주간 목표</dt>
        <dd>
          {t.weeklyGoalsAchieved}/{t.weeklyGoalsTotal} 달성
        </dd>
      </dl>
      <ul className="week-bars">
        {journal.days.map((d) => {
          const seconds = studySeconds(d.summary)
          return (
            <li key={d.date}>
              <span className="muted small">{dayLabel(d.date).slice(-3)}</span>
              <span className="week-bar-track">
                <span className="week-bar-fill" style={{ width: `${(seconds / max) * 100}%` }} />
              </span>
              <span className="small">{seconds > 0 ? formatDuration(seconds) : '-'}</span>
              <span title="컨디션">{d.condition ? CONDITION_LABELS[d.condition] : ''}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
