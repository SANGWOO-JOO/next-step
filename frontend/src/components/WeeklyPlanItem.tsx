import { useState, type FormEvent } from 'react'
import { createDailyGoal } from '../api/dailyGoals'
import { deleteWeeklyPlan, updateWeeklyPlan, type WeeklyPlan } from '../api/weeklyPlans'
import { dayLabel } from '../utils/date'
import FormButtons from './FormButtons'
import MoreMenu from './MoreMenu'

type Props = {
  plan: WeeklyPlan
  /** 그날 같은 내용의 하루 목표가 이미 있으면 '하루 목표로'를 막는다 */
  hasDailyGoal: boolean
  run: (action: () => Promise<unknown>) => Promise<boolean>
  /** 넘기면 수정·삭제를 보여주고 이 날짜들 사이로 옮길 수 있다 */
  weekDates?: string[]
  /** 다른 주간 목표를 강조하는 중이면 흐리게 */
  dimmed?: boolean
}

/** 계획 카드를 다른 요일로 끌 때 쓰는 dataTransfer 형식 */
export const PLAN_DRAG_TYPE = 'application/x-weekly-plan'

/** 요일별 계획 한 줄. '하루 목표로'를 누르면 같은 내용의 하루 목표를 만든다. */
export default function WeeklyPlanItem({ plan, hasDailyGoal, run, weekDates, dimmed }: Props) {
  const [editing, setEditing] = useState(false)
  const [date, setDate] = useState(plan.date)
  const [content, setContent] = useState(plan.content)

  const toDailyGoal = () =>
    run(() =>
      createDailyGoal({
        weeklyGoalId: plan.weeklyGoalId,
        date: plan.date,
        content: plan.content,
        firstAction: null,
        categoryId: null,
        type: null,
      }),
    )

  const submit = (e: FormEvent) => {
    e.preventDefault()
    run(() => updateWeeklyPlan(plan.id, { date, content })).then((ok) => ok && setEditing(false))
  }

  if (editing && weekDates) {
    return (
      <form className="inline-form plan-form" onSubmit={submit}>
        <select value={date} onChange={(e) => setDate(e.target.value)} aria-label="요일">
          {weekDates.map((d) => (
            <option key={d} value={d}>
              {dayLabel(d)}
            </option>
          ))}
        </select>
        <input className="grow" value={content} onChange={(e) => setContent(e.target.value)} required maxLength={500} />
        <FormButtons submitLabel="저장" onCancel={() => setEditing(false)} />
      </form>
    )
  }

  // 주간 보드에서는 카드 모양 + ⋯ 메뉴, 일정 화면의 '가져올 것'에서는 버튼 한 줄
  if (weekDates) {
    return (
      <li
        className={dimmed ? 'plan-card dimmed' : 'plan-card'}
        style={{ borderLeftColor: plan.category?.color ?? 'var(--muted)' }}
        draggable
        onDragStart={(e) => e.dataTransfer.setData(PLAN_DRAG_TYPE, String(plan.id))}
        title={`주간 목표: ${plan.weeklyGoalContent} · 다른 요일로 끌어 옮길 수 있어요`}
      >
        <span className="plan-content">
          {hasDailyGoal && <span className="plan-done" title="하루 목표로 만들었어요">✓ </span>}
          {plan.content}
        </span>
        <MoreMenu
          label="계획 동작"
          items={[
            { label: '하루 목표로', onClick: toDailyGoal, show: !hasDailyGoal },
            { label: '수정', onClick: () => setEditing(true) },
            {
              label: '삭제',
              danger: true,
              onClick: () => confirm(`'${plan.content}' 계획을 삭제할까요?`) && run(() => deleteWeeklyPlan(plan.id)),
            },
          ]}
        />
      </li>
    )
  }

  return (
    <li className="plan-item">
      <span className="badge-dot" style={{ background: plan.category?.color ?? 'var(--muted)' }} />
      <span className="plan-content" title={`주간: ${plan.weeklyGoalContent}`}>
        {plan.content}
      </span>
      <button
        className="ghost"
        disabled={hasDailyGoal}
        title={hasDailyGoal ? '이미 하루 목표가 있어요' : undefined}
        onClick={toDailyGoal}
      >
        {hasDailyGoal ? '✓ 하루 목표' : '하루 목표로'}
      </button>
    </li>
  )
}
