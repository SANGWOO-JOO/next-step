import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getCategories, type Category } from '../../api/categories'
import { errorMessage } from '../../api/client'
import { getGoals, type Goal } from '../../api/goals'
import { addMonths, mondayOf, mondaysOfMonth, monthLabel, shiftDate, todaySeoul, weekLabel } from '../../utils/date'
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
  const [drawer, setDrawer] = useState(false)

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
  const monthly = goals?.flatMap((g) => g.monthlyGoals).filter((m) => m.month === month) ?? []
  const openMonth = (m: string) => go('month', mondaysOfMonth(m).includes(mondayOf(todaySeoul())) ? mondayOf(todaySeoul()) : firstMondayOf(m))

  return (
    <section>
      <div className="plan-header">
        <button className="icon" onClick={() => setDrawer(!drawer)} aria-label="목표 트리" aria-expanded={drawer}>
          ☰
        </button>
        <nav className="plan-path" aria-label="경로">
          <button className="ghost" onClick={() => go('goal')}>
            {goal?.title ?? '최종 목표'}
          </button>
          {level !== 'goal' && (
            <>
              ›
              <button className="ghost" onClick={() => go('month')}>
                {monthLabel(month).slice(6)}
                {monthly[0] && `: ${monthly[0].content}`}
              </button>
            </>
          )}
          {level === 'week' && (
            <>
              › <strong>{weekLabel(monday)} 주</strong>
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

      {drawer && goals && (
        <TreeDrawer
          goals={goals}
          onPick={(l, date) => {
            go(l, date)
            setDrawer(false)
          }}
          onClose={() => setDrawer(false)}
        />
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

type DrawerProps = { goals: Goal[]; onPick: (level: Level, date: string) => void; onClose: () => void }

/** 최종 → 월 → 주 지도. 누르면 그 레벨로 이동한다 */
function TreeDrawer({ goals, onPick, onClose }: DrawerProps) {
  return (
    <div className="wizard-backdrop drawer-backdrop" onClick={onClose}>
      <nav className="card plan-drawer" onClick={(e) => e.stopPropagation()} aria-label="목표 트리">
        {goals.map((g) => (
          <div key={g.id} className="drawer-goal">
            <button className="ghost drawer-node" onClick={() => onPick('goal', todaySeoul())}>
              <strong>{g.title}</strong> <span className="muted small">{g.progress.percent}%</span>
            </button>
            {[...new Set(g.monthlyGoals.map((m) => m.month))].sort().map((month) => (
              <div key={month} className="drawer-month">
                <button className="ghost drawer-node" onClick={() => onPick('month', firstMondayOf(month))}>
                  {monthLabel(month)} · {g.monthlyGoals.filter((m) => m.month === month).map((m) => m.content).join(', ')}
                </button>
                {mondaysOfMonth(month).map((monday) => {
                  const weekly = weeklyGoalsOf([g], monday)
                  return (
                    <button key={monday} className="ghost drawer-node drawer-week" onClick={() => onPick('week', monday)}>
                      {weekLabel(monday)}
                      {weekly.length > 0 && <span className="muted small"> · {weekly.map((w) => (w.achieved ? '✓ ' : '') + w.content).join(', ')}</span>}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        ))}
      </nav>
    </div>
  )
}
