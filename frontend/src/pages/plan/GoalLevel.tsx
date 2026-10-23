import { useEffect, useState } from 'react'
import type { Category } from '../../api/categories'
import { getDailyGoalsBetween, type DailyGoal } from '../../api/dailyGoals'
import { createGoal, createMonthlyGoal, deleteGoal, GOAL_STATUS_LABEL, updateGoal, type Goal } from '../../api/goals'
import { GoalForm, MonthlyGoalForm } from '../../components/GoalTree'
import MoreMenu from '../../components/MoreMenu'
import { currentMonthSeoul, mondayOf, monthLabel, shiftDate, todaySeoul } from '../../utils/date'
import { elapsedPercent, HEALTH_LABELS, healthOf, monthRange } from '../../utils/health'
import { monthlyPercent, weeklyGoalsOf, type Run } from './planData'

type Props = {
  goals: Goal[]
  categories: Category[]
  run: Run
  onOpenMonth: (month: string) => void
  onOpenWeek: (monday: string) => void
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)

/**
 * [최종](docs/design.md 1-4f ⑧·⑳, Linear 프로젝트 개요·Asana Goals 참고): 상태 한 줄 + "지금"(이번 달·이번 주) +
 * 월간 목표 목록. 공부 통계는 대시보드에서. 진행 중인 최종 목표는 하나뿐이다.
 */
export default function GoalLevel({ goals, run, onOpenMonth, onOpenWeek }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [addingMonthly, setAddingMonthly] = useState(false)
  const [weekGoals, setWeekGoals] = useState<DailyGoal[]>([])
  const today = todaySeoul()
  const monday = mondayOf(today)
  const goal = goals.find((g) => g.status === 'ACTIVE') ?? null
  const others = goals.filter((g) => g.status !== 'ACTIVE')

  useEffect(() => {
    if (!goal) return
    getDailyGoalsBetween(monday, shiftDate(monday, 6))
      .then(setWeekGoals)
      .catch(() => setWeekGoals([]))
  }, [goal?.id, goal?.startDate, today, monday]) // eslint-disable-line react-hooks/exhaustive-deps

  const editForm = (g: Goal) => (
    <GoalForm
      initial={g}
      submitLabel="저장"
      onSubmit={(input) => run(() => updateGoal(g.id, input)).then((ok) => ok && setEditingId(null))}
      onCancel={() => setEditingId(null)}
    />
  )

  return (
    <div className="goal-page">
      {goal &&
        (editingId === goal.id ? (
          <div className="card">{editForm(goal)}</div>
        ) : (
          <GoalOverview
            goal={goal}
            today={today}
            monday={monday}
            goals={goals}
            weekGoals={weekGoals}
            run={run}
            onEdit={() => setEditingId(goal.id)}
            onOpenMonth={onOpenMonth}
            onOpenWeek={onOpenWeek}
            addingMonthly={addingMonthly}
            setAddingMonthly={setAddingMonthly}
          />
        ))}

      {!goal &&
        (adding ? (
          <div className="card">
            <h3 className="timeline-title">새 최종 목표</h3>
            <GoalForm
              submitLabel="추가"
              onSubmit={(input) => run(() => createGoal(input)).then((ok) => ok && setAdding(false))}
              onCancel={() => setAdding(false)}
            />
          </div>
        ) : (
          <div className="card empty-cta">
            <p className="muted">이직 목표를 하나 정해 보세요. 그 아래로 월간·주간 목표를 이어 가요.</p>
            <button onClick={() => setAdding(true)}>최종 목표 만들기</button>
          </div>
        ))}

      {others.length > 0 && (
        <div className="card">
          <h3 className="timeline-title">완료·중단한 목표</h3>
          <ul className="unfinished-list">
            {others.map((g) =>
              editingId === g.id ? (
                <li key={g.id}>{editForm(g)}</li>
              ) : (
                <li key={g.id}>
                  <span>{g.title}</span>
                  <span className="muted small">
                    {GOAL_STATUS_LABEL[g.status]} · {g.startDate} ~ {g.targetDate}
                  </span>
                  <GoalMenu goal={g} run={run} onEdit={() => setEditingId(g.id)} />
                </li>
              ),
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

type OverviewProps = {
  goal: Goal
  today: string
  monday: string
  goals: Goal[]
  weekGoals: DailyGoal[]
  run: Run
  onEdit: () => void
  onOpenMonth: (month: string) => void
  onOpenWeek: (monday: string) => void
  addingMonthly: boolean
  setAddingMonthly: (v: boolean) => void
}

function GoalOverview({
  goal,
  today,
  monday,
  goals,
  weekGoals,
  run,
  onEdit,
  onOpenMonth,
  onOpenWeek,
  addingMonthly,
  setAddingMonthly,
}: OverviewProps) {
  const health = healthOf(goal.progress.percent, goal.startDate, goal.targetDate, today)
  const left = daysBetween(today, goal.targetDate)
  const month = currentMonthSeoul()
  const thisMonth = goal.monthlyGoals.filter((m) => m.month === month)
  const thisWeek = weeklyGoalsOf(goals, monday)
  const weekDone = weekGoals.filter((d) => d.status === 'DONE').length

  return (
    <>
      <div className="goal-status-line">
        <span className={`status-chip health-${health}`} title={HEALTH_LABELS[health]}>
          {HEALTH_LABELS[health]}
        </span>
        <span className="muted small">
          {left >= 0 ? `D-${left.toLocaleString()}` : `${(-left).toLocaleString()}일 지남`} · {goal.targetDate}까지 · 기간{' '}
          {elapsedPercent(goal.startDate, goal.targetDate, today)}% 지남 · 월간 목표 {goal.progress.achieved}/
          {goal.progress.total} 달성
        </span>
        <GoalMenu goal={goal} run={run} onEdit={onEdit} />
      </div>
      {goal.description && <p className="muted small goal-why">{goal.description}</p>}

      <div className="goal-cards">
        <div className="card">
          <h3 className="timeline-title">지금</h3>
          {thisMonth.length === 0 ? (
            <button className="ghost goal-now-row" onClick={() => onOpenMonth(month)}>
              <span>{Number(month.slice(5))}월 월간 목표 없음</span>
              <span className="muted small">만들기 ›</span>
            </button>
          ) : (
            thisMonth.map((m) => (
              <button key={m.id} className="ghost goal-now-row" onClick={() => onOpenMonth(month)}>
                <span>
                  {Number(month.slice(5))}월 · {m.content}
                </span>
                <span className="muted small">{monthlyPercent(m)}% ›</span>
                <span className="goal-bar">
                  <span className="goal-bar-fill" style={{ width: `${monthlyPercent(m)}%` }} />
                </span>
              </button>
            ))
          )}
          <button className="ghost goal-now-row" onClick={() => onOpenWeek(monday)}>
            <span>이번 주 · {thisWeek.length ? thisWeek.map((w) => w.content).join(', ') : '주간 목표 없음'}</span>
            <span className="muted small">
              할 일 {weekDone}/{weekGoals.length} ›
            </span>
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="timeline-title">월간 목표</h3>
        <ul className="goal-milestones">
          {goal.monthlyGoals.map((m) => {
            const { from, to } = monthRange(m.month)
            const percent = monthlyPercent(m)
            const h = healthOf(percent, from, to, today, m.achieved)
            return (
              <li key={m.id}>
                <button className="ghost goal-milestone" onClick={() => onOpenMonth(m.month)} title={`${monthLabel(m.month)} 보기`}>
                  <span className="muted">{Number(m.month.slice(5))}월</span>
                  <span className={m.achieved ? 'done' : undefined}>{m.content}</span>
                  <span className="goal-bar">
                    <span className="goal-bar-fill" style={{ width: `${percent}%` }} />
                  </span>
                  <span className="muted small">{percent}%</span>
                  <span className={`health health-${h}`} title={HEALTH_LABELS[h]}>
                    <span className="health-dot" />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {addingMonthly ? (
          <MonthlyGoalForm
            goal={goal}
            defaultMonth={month}
            submitLabel="추가"
            onSubmit={(input) => run(() => createMonthlyGoal(goal.id, input)).then((ok) => ok && setAddingMonthly(false))}
            onCancel={() => setAddingMonthly(false)}
          />
        ) : (
          <button className="ghost add" onClick={() => setAddingMonthly(true)}>
            + 월간 목표
          </button>
        )}
      </div>
    </>
  )
}

/** 최종 목표 ⋯ 메뉴: 수정(완료·중단도 여기서)·삭제 */
function GoalMenu({ goal, run, onEdit }: { goal: Goal; run: Run; onEdit: () => void }) {
  return (
    <MoreMenu
      label="최종 목표 동작"
      items={[
        { label: goal.status === 'ACTIVE' ? '수정 · 완료/중단하기' : '수정', onClick: onEdit },
        {
          label: '삭제',
          danger: true,
          onClick: () =>
            confirm(
              goal.monthlyGoals.length > 0
                ? `'${goal.title}' 최종 목표와 그 아래 월간 목표 ${goal.monthlyGoals.length}개를 삭제할까요?`
                : `'${goal.title}' 최종 목표를 삭제할까요?`,
            ) && run(() => deleteGoal(goal.id)),
        },
      ]}
    />
  )
}
