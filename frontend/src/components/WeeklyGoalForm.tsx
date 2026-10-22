import { useState, type FormEvent } from 'react'
import type { Category } from '../api/categories'
import type { WeeklyGoal, WeeklyGoalInput } from '../api/goals'
import { mondayOf, mondaysOfMonth, todaySeoul, weekLabel } from '../utils/date'
import FormButtons from './FormButtons'

type Props = {
  /** 주간 목표가 속한 월간 목표의 달. 이 달에 속한 주만 고를 수 있다. */
  month: string
  categories: Category[]
  initial?: WeeklyGoal
  /** 새로 추가할 때 미리 골라 둘 주 */
  defaultWeekStart?: string
  /** false면 주 선택을 숨긴다(캘린더에서 주가 정해져 있을 때) */
  showWeek?: boolean
  submitLabel: string
  onSubmit: (input: WeeklyGoalInput) => void
  onCancel: () => void
}

export default function WeeklyGoalForm({
  month,
  categories,
  initial,
  defaultWeekStart,
  showWeek = true,
  submitLabel,
  onSubmit,
  onCancel,
}: Props) {
  const mondays = mondaysOfMonth(month)
  const thisMonday = mondayOf(todaySeoul())
  const [weekStart, setWeekStart] = useState(
    initial?.weekStart ?? defaultWeekStart ?? (mondays.includes(thisMonday) ? thisMonday : mondays[0]),
  )
  const [content, setContent] = useState(initial?.content ?? '')
  const [categoryId, setCategoryId] = useState<number | null>(initial?.category?.id ?? null)

  // 이미 지정된 비활성 분류는 선택지에 남겨 둔다
  const options = [...categories]
  if (initial?.category && !categories.some((c) => c.id === initial.category?.id)) {
    options.push({ ...initial.category, sortOrder: 0, targetRatio: null, weeklyTargetMinutes: null })
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit({ weekStart, content, categoryId, achieved: initial?.achieved ?? false })
  }

  return (
    <form className="inline-form tree-form" onSubmit={submit}>
      {showWeek && (
        <select value={weekStart} onChange={(e) => setWeekStart(e.target.value)} aria-label="주">
          {mondays.map((m) => (
            <option key={m} value={m}>
              {weekLabel(m)}
            </option>
          ))}
        </select>
      )}
      <input
        className="grow"
        placeholder="예: 경력기술서 초안 작성"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        required
      />
      <select
        value={categoryId ?? ''}
        onChange={(e) => setCategoryId(e.target.value === '' ? null : Number(e.target.value))}
        aria-label="분류"
      >
        <option value="">미분류</option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.active ? c.name : `${c.name} (비활성)`}
          </option>
        ))}
      </select>
      <FormButtons submitLabel={submitLabel} onCancel={onCancel} />
    </form>
  )
}
