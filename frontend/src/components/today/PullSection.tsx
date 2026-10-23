import { moveDailyGoal, type DailyGoal } from '../../api/dailyGoals'
import type { WeeklyPlan } from '../../api/weeklyPlans'
import WeeklyPlanItem from '../WeeklyPlanItem'

type Props = {
  today: string
  /** 지난 날짜의 미완료 하루 목표 */
  unfinished: DailyGoal[]
  /** 이번 주 계획 중 오늘 날짜의 것 */
  plans: WeeklyPlan[]
  /** 오늘 하루 목표(계획을 이미 목표로 만들었는지 확인용) */
  goals: DailyGoal[]
  run: (action: () => Promise<unknown>) => Promise<boolean>
}

/**
 * 오늘로 가져올 것: 지난 미완료 + 이번 주 계획 중 오늘 것(docs/design.md 6장 1-4d, Todoist의 기한 지남 구역 참고).
 * 하나도 없으면 숨기고, 있으면 펼친 채로 보여준다.
 */
export default function PullSection({ today, unfinished, plans, goals, run }: Props) {
  const pendingPlans = plans.filter((p) => !goals.some((g) => g.content === p.content))
  const count = unfinished.length + pendingPlans.length
  if (count === 0) return null

  // 지난주 목표는 오늘로 오면 주간 목표 연결이 풀린다(1-4f, 나중에 ⋯ 메뉴로 연결)
  const moveToToday = (g: DailyGoal) => moveDailyGoal(g.id, today, null)

  const moveAll = () => {
    const targets = unfinished
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
          <button className="ghost" onClick={moveAll}>
            미완료 모두 오늘로
          </button>
        )}
      </div>
      <ul className="plan-list">
        {unfinished.map((g) => (
          <li key={g.id} className="plan-item">
            <span className="pull-tag overdue">{Number(g.date.slice(5, 7))}/{Number(g.date.slice(8))}</span>
            <span className="plan-content">
              {g.content}
              {g.carryCount > 0 && <span className="carry">↻{g.carryCount}</span>}
            </span>
            <button className="ghost" onClick={() => run(() => moveToToday(g))}>
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
