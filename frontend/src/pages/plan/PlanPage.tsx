import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getCategories, type Category } from '../../api/categories'
import { errorMessage } from '../../api/client'
import { getGoals, type Goal } from '../../api/goals'
import { addMonths, currentMonthSeoul, mondayOf, mondaysOfMonth, monthLabel, shiftDate, todaySeoul, weekLabel } from '../../utils/date'
import GoalLevel from './GoalLevel'
import MonthLevel from './MonthLevel'
import { activeGoal, anchorOf, firstMondayOf, weeklyGoalsOf, type Level, type Run } from './planData'
import WeekLevel from './WeekLevel'

const LEVEL_LABELS: Record<Level, string> = { goal: '최종', month: '월', week: '주' }

/**
 * 계획 화면(docs/design.md 6장 3~5): 줌 레벨 [최종][월][주] + 경로 + 목표 트리 서랍.
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
  // 경로 드롭다운의 달: 진행 중 최종 목표의 기간(없으면 이번 달 앞뒤 6개월), 지금 보는 달은 꼭 포함
  const pathMonths = (() => {
    const from = goal ? goal.startDate.slice(0, 7) : addMonths(currentMonthSeoul(), -6)
    const to = goal ? goal.targetDate.slice(0, 7) : addMonths(currentMonthSeoul(), 6)
    const list: string[] = []
    for (let m = from; m <= to && list.length < 120; m = addMonths(m, 1)) list.push(m)
    return list.includes(month) ? list : [...list, month].sort()
  })()
  const monthlyTitle = (m: string) => {
    const first = goals?.flatMap((g) => g.monthlyGoals).find((x) => x.month === m)
    return first ? ` · ${first.content}` : ''
  }
  const openMonth = (m: string) => go('month', mondaysOfMonth(m).includes(mondayOf(todaySeoul())) ? mondayOf(todaySeoul()) : firstMondayOf(m))

  return (
    <section>
      <div className="plan-header">
        <nav className="plan-path" aria-label="경로">
          <button className="ghost" onClick={() => go('goal')}>
            {goal?.title ?? '최종 목표'}
          </button>
          {level !== 'goal' && (
            <>
              ›
              <select
                className="path-select"
                value={month}
                onChange={(e) => openMonth(e.target.value)}
                aria-label="달 고르기"
              >
                {pathMonths.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                    {monthlyTitle(m)}
                  </option>
                ))}
              </select>
            </>
          )}
          {level === 'week' && (
            <>
              ›
              <select className="path-select" value={monday} onChange={(e) => go('week', e.target.value)} aria-label="주 고르기">
                {mondaysOfMonth(month).map((m) => (
                  <option key={m} value={m}>
                    {weekLabel(m)} 주{weeklyGoalsOf(goals ?? [], m).length ? ` · ${weeklyGoalsOf(goals ?? [], m)[0].content}` : ''}
                  </option>
                ))}
              </select>
            </>
          )}
        </nav>
        <span className="segmented" role="group" aria-label="보기 단위">
          {(Object.keys(LEVEL_LABELS) as Level[]).map((l) => (
            <button key={l} className={level === l ? 'active' : ''} onClick={() => go(l)}>
              {LEVEL_LABELS[l]}
            </button>
          ))}
        </span>
        {level !== 'goal' && (
          <span className="row-actions">
            <button className="icon" onClick={() => move(-1)} aria-label="이전">
              ‹
            </button>
            <button className="ghost" onClick={() => go(level, mondayOf(todaySeoul()))}>
              오늘
            </button>
            <button className="icon" onClick={() => move(1)} aria-label="다음">
              ›
            </button>
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
        <GoalLevel goals={goals} categories={categories} run={run} onOpenMonth={openMonth} />
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
