import { useState, type FormEvent } from 'react'
import type { DailyGoal } from '../api/dailyGoals'
import type { TimeBlockInput } from '../api/timeBlocks'
import { formatMinutes, parseTime, seoulIso } from '../utils/date'

type Props = {
  date: string
  /** 블록을 연결할 수 있는 그날의 하루 목표 */
  goals: DailyGoal[]
  dailyGoalId: number
  /** 그날 0시부터의 분 */
  startMinutes: number
  endMinutes: number
  submitLabel: string
  onSubmit: (input: TimeBlockInput) => void
  onCancel: () => void
  onDelete?: () => void
}

/** 시간 블록 추가·수정 폼. 종료를 00:00으로 고르면 그날 24:00으로 본다. */
export default function TimeBlockForm({
  date,
  goals,
  dailyGoalId: initialGoalId,
  startMinutes,
  endMinutes,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
}: Props) {
  const [dailyGoalId, setDailyGoalId] = useState(initialGoalId)
  const [start, setStart] = useState(formatMinutes(startMinutes))
  const [end, setEnd] = useState(formatMinutes(endMinutes % 1440))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const startMin = parseTime(start)
    const endMin = end === '00:00' ? 1440 : parseTime(end)
    onSubmit({ dailyGoalId, startAt: seoulIso(date, startMin), endAt: seoulIso(date, endMin) })
  }

  return (
    <form className="inline-form block-form" onSubmit={submit}>
      <select value={dailyGoalId} onChange={(e) => setDailyGoalId(Number(e.target.value))} aria-label="하루 목표">
        {goals.map((g) => (
          <option key={g.id} value={g.id}>
            {g.type === 'CORE' ? '★ ' : ''}
            {g.content}
          </option>
        ))}
      </select>
      <input type="time" step={600} value={start} onChange={(e) => setStart(e.target.value)} required aria-label="시작" />
      ~
      <input type="time" step={600} value={end} onChange={(e) => setEnd(e.target.value)} required aria-label="종료" />
      <span className="row-actions">
        <button type="submit">{submitLabel}</button>
        <button type="button" className="ghost" onClick={onCancel}>
          취소
        </button>
        {onDelete && (
          <button type="button" className="danger" onClick={onDelete}>
            삭제
          </button>
        )}
      </span>
    </form>
  )
}
