import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getCategories, type Category } from '../../api/categories'
import { errorMessage } from '../../api/client'
import { getGoals, type Goal } from '../../api/goals'
import { addMonths, mondayOf, mondaysOfMonth, monthLabel, shiftDate, todaySeoul } from '../../utils/date'
import GoalLevel from './GoalLevel'
import MonthLevel from './MonthLevel'
import { activeGoal, anchorOf, firstMondayOf, type Level, type Run } from './planData'
import WeekLevel from './WeekLevel'

const LEVEL_LABELS: Record<Level, string> = { goal: '최종', month: '월', week: '주' }

/**
 * 계획 화면(docs/design.md 6장 3~5): 줌 레벨 [최종][월][주] + 기간 제목과 상위 목표 한 줄.
 * 주소에 level과 date(그 주의 월요일)를 남겨 새로고침·뒤로가기에도 유지한다.
 */
export default function PlanPage() {
  const [params, setParams] = useSearchParams()
  const level: Level = params.get('level') === 'goal' || params.get('level') === 'month' ? (params.get('level') as Level) : 'week'
  const { monday, month } = anchorOf(params.get('date') ?? todaySeoul())
  const [goals, setGoals] = useState<Goal[] | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)

  const go = (next: Level, date: string = monday) => setParams({ level: next, date })

  const load = useCallback(() => {
    Promise.all([getGoals(), getCategories()])
      .then(([g, c]) => {
        setGoals(g)
        setCategories(c)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [])

  useEffect(load, [load])

  const run: Run = async (action) => {
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

  const move = (delta: number) =>
    level === 'week' ? go('week', shiftDate(monday, delta * 7)) : go('month', firstMondayOf(addMonths(month, delta)))

  const goal = goals ? activeGoal(goals) : null
  const monthlyGoal = goals?.flatMap((g) => g.monthlyGoals).find((x) => x.month === month)
  // 주: "10월 19일 – 25일"(달이 바뀌면 "10월 26일 – 11월 1일"), 월: "2026년 10월", 최종: 목표 이름
  const sunday = shiftDate(monday, 6)
  const md = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일`
  const periodTitle =
    level === 'goal'
      ? (goal?.title ?? '최종 목표')
      : level === 'month'
        ? monthLabel(month)
        : sunday.slice(5, 7) === monday.slice(5, 7)
          ? `${md(monday)} – ${Number(sunday.slice(8))}일`
          : `${md(monday)} – ${md(sunday)}`
  const openMonth = (m: string) => go('month', mondaysOfMonth(m).includes(mondayOf(todaySeoul())) ? mondayOf(todaySeoul()) : firstMondayOf(m))

  return (
    <section>
      {/* Google Calendar처럼 왼쪽에 [오늘] ‹ › 기간 제목, 오른쪽에 보기 단위(1-4f ⑫) */}
      <div className="plan-header cal-header">
        <span className="cal-nav">
          {level !== 'goal' && (
            <>
              <button className="ghost" onClick={() => go(level, mondayOf(todaySeoul()))}>오늘</button>
              <button className="icon" onClick={() => move(-1)} aria-label={level === 'week' ? '이전 주' : '이전 달'} title={level === 'week' ? '이전 주' : '이전 달'}>
                ‹
              </button>
              <button className="icon" onClick={() => move(1)} aria-label={level === 'week' ? '다음 주' : '다음 달'} title={level === 'week' ? '다음 주' : '다음 달'}>
                ›
              </button>
            </>
          )}
          <div className="plan-heading">
          <h1 className="plan-period">{periodTitle}</h1>
          {level !== 'goal' && (
            <p className="plan-context muted small">
              <button className="link-button" onClick={() => go('goal')}>
                {goal?.title ?? '최종 목표 없음'}
              </button>
              {level === 'month' && month === todaySeoul().slice(0, 7) && (
                <span>
                  {' · '}달 {Number(todaySeoul().slice(8))}/{new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()}일 지남
                </span>
              )}
              {level === 'week' && (
                <>
                  {' · '}
                  <button className="link-button" onClick={() => openMonth(month)}>
                    {Number(month.slice(5))}월: {monthlyGoal?.content ?? '월간 목표 없음'}
                  </button>
                </>
              )}
            </p>
          )}
        </div>
        </span>
        <span className="segmented" role="group" aria-label="보기 단위">
          {(Object.keys(LEVEL_LABELS) as Level[]).map((l) => (
            <button key={l} className={level === l ? 'active' : ''} onClick={() => go(l)}>
              {LEVEL_LABELS[l]}
            </button>
          ))}
        </span>
      </div>
      {error && (
        <p className="error-banner" role="alert">
          {error}
          <button className="icon" onClick={() => setError(null)} aria-label="닫기">
            ×
          </button>
        </p>
      )}


      {!goals ? (
        <p className="muted">불러오는 중…</p>
      ) : level === 'goal' ? (
        <GoalLevel goals={goals} categories={categories} run={run} onOpenMonth={openMonth} onOpenWeek={(m) => go('week', m)} />
      ) : level === 'month' ? (
        <MonthLevel
          month={month}
          goals={goals}
          categories={categories}
          run={run}
          onOpenWeek={(m) => go('week', m)}
          onOpenGoalLevel={() => go('goal')}
        />
      ) : (
        <WeekLevel monday={monday} goals={goals} categories={categories} run={run} />
      )}
    </section>
  )
}
