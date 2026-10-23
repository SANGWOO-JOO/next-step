import { useState, type FormEvent } from 'react'
import type { DailyGoal } from '../api/dailyGoals'
import type { TimeBlockInput } from '../api/timeBlocks'
import { formatMinutes, parseTime, seoulIso } from '../utils/date'

type Props = {
  date: string
  /** 블록을 연결할 수 있는 그날의 하루 목표 */
  goals: DailyGoal[]
  /** null이면 목표가 아닌 일정 */
  dailyGoalId: number | null
  /** 목표 없는 일정의 제목 */
  title?: string | null
  /** true면 '목표 아닌 일정' 선택지를 보여준다 */
  allowFree?: boolean
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
  title: initialTitle,
  allowFree = false,
  startMinutes,
  endMinutes,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
}: Props) {
  const [dailyGoalId, setDailyGoalId] = useState<number | null>(initialGoalId)
  const [title, setTitle] = useState(initialTitle ?? '')
  const [start, setStart] = useState(formatMinutes(startMinutes))
  const [end, setEnd] = useState(formatMinutes(endMinutes % 1440))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const startMin = parseTime(start)
    const endMin = end === '00:00' ? 1440 : parseTime(end)
    onSubmit({
      dailyGoalId,
      title: dailyGoalId === null ? title.trim() : null,
      date,
      startAt: seoulIso(date, startMin),
      endAt: seoulIso(date, endMin),
    })
  }

  return (
    <form className="inline-form block-form" onSubmit={submit}>
      <select
        value={dailyGoalId ?? ''}
        onChange={(e) => setDailyGoalId(e.target.value === '' ? null : Number(e.target.value))}
        aria-label="하루 목표"
      >
        {allowFree && <option value="">목표 아닌 일정 (밥, 산책 등)</option>}
        {goals.map((g) => (
          <option key={g.id} value={g.id}>
            {g.content}
          </option>
        ))}
      </select>
      {dailyGoalId === null && (
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 점심, 산책"
          maxLength={100}
          required
          autoFocus
          aria-label="일정 제목"
        />
      )}
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
