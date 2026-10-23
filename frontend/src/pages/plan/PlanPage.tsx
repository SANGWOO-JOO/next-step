import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getCategories, type Category } from '../../api/categories'
import { errorMessage } from '../../api/client'
import { getGoals, type Goal } from '../../api/goals'
import { addMonths, mondayOf, mondaysOfMonth, monthLabel, shiftDate, todaySeoul } from '../../utils/date'
import chevronLeft from '../../assets/icons/chevron-left.svg'
import chevronRight from '../../assets/icons/chevron-right.svg'
import IconButton from '../../components/IconButton'
import GoalLevel from './GoalLevel'
import MonthLevel from './MonthLevel'
import { activeGoal, anchorOf, firstMondayOf, type Level, type Run } from './planData'
import WeekLevel from './WeekLevel'

/**
 * 계획 화면(docs/design.md 6장 3~5, 1-4f (51)): 최종 › 월 › 주 경로로 목표 안으로 들어간다. 첫 화면은 이번 주.
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
      {/* 목표 안으로 들어가는 경로(1-4f (51)): 큰 단위부터, 지금 단계만 알약. 기간을 바꾸는 알약 버튼(일정·기록)과 모양으로 구분 */}
      <div className="plan-header cal-header">
        <nav className="plan-crumbs" aria-label="계획 단계">
          {level === 'goal' ? (
            <span className="plan-crumb current" aria-current="page">
              🎯 {goal?.title ?? '최종 목표'}
            </span>
          ) : (
            <button className="plan-crumb" onClick={() => go('goal')}>
              🎯 {goal?.title ?? '최종 목표'}
            </button>
          )}
          {level !== 'goal' && (
            <>
              <span className="plan-crumb-sep" aria-hidden="true">›</span>
              {level === 'month' ? (
                <span className="plan-crumb current" aria-current="page">
                  {monthLabel(month)}
                </span>
              ) : (
                <button className="plan-crumb" onClick={() => openMonth(month)} title={monthlyGoal?.content ?? '월간 목표 없음'}>
                  {Number(month.slice(5))}월
                </button>
              )}
            </>
          )}
          {level === 'week' && (
            <>
              <span className="plan-crumb-sep" aria-hidden="true">›</span>
              <span className="plan-crumb current" aria-current="page">
                {periodTitle}
              </span>
            </>
          )}
          {level === 'month' && (
            <span className="plan-crumb-hint muted small" aria-hidden="true">
              › 주 고르기
            </span>
          )}
        </nav>
        {level !== 'goal' && (
          <span className="cal-nav">
            <button className="ghost" onClick={() => go(level, mondayOf(todaySeoul()))}>
              오늘
            </button>
            <IconButton icon={chevronLeft} label={level === 'week' ? '이전 주' : '이전 달'} onClick={() => move(-1)} />
            <IconButton icon={chevronRight} label={level === 'week' ? '다음 주' : '다음 달'} onClick={() => move(1)} />
          </span>
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
