import { moveDailyGoal, type DailyGoal } from '../../api/dailyGoals'
import pullIcon from '../../assets/icons/pull.svg'
import IconButton from '../IconButton'

type Props = {
  today: string
  /** 지난 날짜의 미완료 하루 목표 */
  unfinished: DailyGoal[]
  run: (action: () => Promise<unknown>) => Promise<boolean>
}

/**
 * 오늘로 가져올 것: 지난 미완료 하루 목표(docs/design.md 6장 1-4d·1-4f, Todoist의 기한 지남 구역 참고).
 * 하나도 없으면 숨기고, 있으면 펼친 채로 보여준다.
 */
export default function PullSection({ today, unfinished, run }: Props) {
  if (unfinished.length === 0) return null

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
        <h4 className="pull-title">
          지난 할 일 <span className="muted">{unfinished.length}</span>
        </h4>
        {unfinished.length > 1 && (
          <button className="link-button small pull-all" onClick={moveAll}>
            모두 오늘로
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
            <IconButton icon={pullIcon} label="오늘로 가져오기" onClick={() => run(() => moveToToday(g))} />
          </li>
        ))}
      </ul>
    </div>
  )
}
