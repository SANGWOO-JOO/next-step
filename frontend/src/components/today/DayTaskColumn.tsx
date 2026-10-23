import { toDailyGoalUpdateInput, updateDailyGoal, type DailyGoal } from '../../api/dailyGoals'
import type { TimeBlock } from '../../api/timeBlocks'
import { minutesOfDay } from '../../utils/date'
import { GOAL_DRAG_TYPE } from '../ScheduleView'

type Props = {
  date: string
  goals: DailyGoal[]
  blocks: TimeBlock[]
  run: (action: () => Promise<unknown>) => Promise<boolean>
}

const planned = (minutes: number) => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h && m ? `${h}시간 ${m}분` : h ? `${h}시간` : `${m}분`
}

/**
 * 넓게 보기 [일] 보기의 왼쪽 할 일 카드 열(docs/design.md 1-4f ㊸, Sunsama·Akiflow 타임블로킹 참고).
 * 카드를 끌어 오른쪽 시간표에 놓으면 1시간 블록이 생긴다. 시간을 잡은 카드는 잡은 시간을 보여 준다.
 */
export default function DayTaskColumn({ date, goals, blocks, run }: Props) {
  const minutesOf = (goal: DailyGoal) =>
    blocks
      .filter((b) => b.dailyGoalId === goal.id)
      .reduce((sum, b) => sum + minutesOfDay(b.endAt, date) - minutesOfDay(b.startAt, date), 0)
  const sorted = [...goals].sort((a, b) => Number(a.status === 'DONE') - Number(b.status === 'DONE'))
  const unscheduled = goals.filter((g) => g.status !== 'DONE' && minutesOf(g) === 0).length

  return (
    <aside className="day-tasks" aria-label="할 일">
      <div className="day-tasks-head">
        <strong>할 일 {goals.length}</strong>
        {unscheduled > 0 && <span className="muted small">시간 안 잡음 {unscheduled}</span>}
      </div>
      {goals.length === 0 && <p className="muted small">위 입력칸에서 분류를 찾아 할 일을 추가해요.</p>}
      <ul className="day-tasks-list">
        {sorted.map((goal) => {
          const done = goal.status === 'DONE'
          const minutes = minutesOf(goal)
          return (
            <li
              key={goal.id}
              className={done ? 'day-task done' : 'day-task'}
              draggable={!done}
              onDragStart={(e) => e.dataTransfer.setData(GOAL_DRAG_TYPE, String(goal.id))}
              title={done ? '완료한 할 일' : '끌어서 시간표에 놓으면 1시간 블록이 생겨요'}
            >
              <input
                type="checkbox"
                checked={done}
                onChange={() =>
                  run(() => updateDailyGoal(goal.id, { ...toDailyGoalUpdateInput(goal), status: done ? 'TODO' : 'DONE' }))
                }
                aria-label="완료"
              />
              <span className="category-dot" style={{ background: goal.category?.color ?? 'var(--muted)' }} aria-hidden="true" />
              <span className="day-task-text">{goal.content}</span>
              {minutes > 0 ? (
                <span className="day-task-time muted small">{planned(minutes)}</span>
              ) : (
                !done && (
                  <span className="day-task-grip" aria-hidden="true">
                    ⠿
                  </span>
                )
              )}
            </li>
          )
        })}
      </ul>
      {unscheduled > 0 && <p className="muted small day-tasks-hint">카드를 끌어 시간표에 놓아요</p>}
    </aside>
  )
}
