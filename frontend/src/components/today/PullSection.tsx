import { useState } from 'react'
import { moveDailyGoal, type DailyGoal } from '../../api/dailyGoals'
import type { WeeklyGoal } from '../../api/goals'
import type { WeeklyPlan } from '../../api/weeklyPlans'
import { mondayOf } from '../../utils/date'
import WeeklyPlanItem from '../WeeklyPlanItem'

type Props = {
  today: string
  /** 지난 날짜의 미완료 하루 목표 */
  unfinished: DailyGoal[]
  /** 이번 주 계획 중 오늘 날짜의 것 */
  plans: WeeklyPlan[]
  /** 오늘 하루 목표(계획을 이미 목표로 만들었는지 확인용) */
  goals: DailyGoal[]
  /** 이번 주 주간 목표(지난주 목표를 옮길 때 연결) */
  weeklyGoals: WeeklyGoal[]
  run: (action: () => Promise<unknown>) => Promise<boolean>
}

/**
 * 오늘로 가져올 것: 지난 미완료 + 이번 주 계획 중 오늘 것(docs/design.md 6장 1-4d, Todoist의 기한 지남 구역 참고).
 * 하나도 없으면 숨기고, 있으면 펼친 채로 보여준다.
 */
export default function PullSection({ today, unfinished, plans, goals, weeklyGoals, run }: Props) {
  const [pickedId, setPickedId] = useState<number | null>(null)
  const thisMonday = mondayOf(today)
  const weeklyGoalId = weeklyGoals.find((w) => w.id === pickedId)?.id ?? weeklyGoals[0]?.id ?? null
  const needsWeekly = (g: DailyGoal) => mondayOf(g.date) !== thisMonday
  const movable = (g: DailyGoal) => !needsWeekly(g) || weeklyGoalId !== null
  const pendingPlans = plans.filter((p) => !goals.some((g) => g.content === p.content))
  const count = unfinished.length + pendingPlans.length
  if (count === 0) return null

  const moveToToday = (g: DailyGoal) => moveDailyGoal(g.id, today, needsWeekly(g) ? weeklyGoalId : null)

  const moveAll = () => {
    const targets = unfinished.filter(movable)
    if (!confirm(`지난 미완료 ${targets.length}개를 모두 오늘로 옮길까요? 넘긴 횟수가 1씩 늘어나요.`)) return
    run(async () => {
      // 차례대로 옮겨야 핵심 3개 제한이 순서대로 적용된다
      for (const g of targets) await moveToToday(g)
    })
  }

  return (
    <div className="pull-section">
      <div className="daily-panel-head">
        <h4 className="pull-title">가져올 것 {count}</h4>
        {unfinished.length > 1 && (
          <button className="ghost" onClick={moveAll} disabled={!unfinished.some(movable)}>
            미완료 모두 오늘로
          </button>
        )}
      </div>
      {unfinished.some(needsWeekly) &&
        (weeklyGoals.length > 0 ? (
          <p className="inline-form small">
            지난주 목표는 이 주간 목표에 연결돼요:
            <select value={weeklyGoalId ?? ''} onChange={(e) => setPickedId(Number(e.target.value))} aria-label="연결할 주간 목표">
              {weeklyGoals.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.content}
                </option>
              ))}
            </select>
          </p>
        ) : (
          <p className="muted small">지난주 목표를 옮기려면 이번 주 주간 목표가 먼저 있어야 해요.</p>
        ))}
      <ul className="plan-list">
        {unfinished.map((g) => (
          <li key={g.id} className="plan-item">
            <span className="pull-tag overdue">{Number(g.date.slice(5, 7))}/{Number(g.date.slice(8))}</span>
            <span className="plan-content">
              {g.content}
              {g.carryCount > 0 && <span className="carry">↻{g.carryCount}</span>}
            </span>
            <button className="ghost" disabled={!movable(g)} onClick={() => run(() => moveToToday(g))}>
              오늘로
            </button>
          </li>
        ))}
        {pendingPlans.map((p) => (
          <WeeklyPlanItem key={p.id} plan={p} hasDailyGoal={false} run={run} />
        ))}
      </ul>
    </div>
  )
}
