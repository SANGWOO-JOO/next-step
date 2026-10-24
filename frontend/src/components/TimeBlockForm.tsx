import { useState, type FormEvent } from 'react'
import type { DailyGoal } from '../api/dailyGoals'
import type { Goal } from '../api/goals'
import type { TimeBlockInput } from '../api/timeBlocks'
import { availableColors } from '../utils/categoryColors'
import { formatMinutes, parseTime, seoulIso } from '../utils/date'
import TopicField from './TopicField'

/**
 * 블록을 넣을 대상이 그날의 할 일이 아닐 때(2-2): 진행 중 목표를 고르거나 새 목표를 만든다.
 * 만드는 쪽(ScheduleView)이 목표 → 그날 할 일 → 블록 순서로 만든다.
 */
export type BlockTarget = { kind: 'goal'; goal: Goal } | { kind: 'new'; title: string; color: string } | null

type Props = {
  date: string
  /** 블록을 연결할 수 있는 그날의 하루 목표 */
  goals: DailyGoal[]
  /** null이면 목표가 아닌 일정 */
  dailyGoalId: number | null
  /** 목표 없는 일정의 제목, 또는 할 일 블록의 주제 */
  title?: string | null
  /** true면 '목표 아닌 일정' 선택지를 보여준다 */
  allowFree?: boolean
  /** 그날 할 일이 없는 진행 중 목표. 주면 고를 수 있고 '새 목표'도 나온다(새 블록에서만) */
  planGoals?: Goal[]
  /** 새 목표 색을 고를 때 피할 색(다른 목표의 색) */
  usedColors?: string[]
  /** 그날 0시부터의 분 */
  startMinutes: number
  endMinutes: number
  submitLabel: string
  onSubmit: (input: TimeBlockInput, target: BlockTarget) => void
  onCancel: () => void
  onDelete?: () => void
}

const FREE = ''
const NEW_GOAL = 'new'

/** 시간 블록 추가·수정 폼. 종료를 00:00으로 고르면 그날 24:00으로 본다. */
export default function TimeBlockForm({
  date,
  goals,
  dailyGoalId: initialGoalId,
  title: initialTitle,
  allowFree = false,
  planGoals,
  usedColors = [],
  startMinutes,
  endMinutes,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
}: Props) {
  // 선택값: 'd:할 일 id' · 'g:목표 id' · 'new' · ''(목표 아닌 일정)
  const [pick, setPick] = useState(initialGoalId !== null ? `d:${initialGoalId}` : planGoals?.[0] ? `g:${planGoals[0].id}` : FREE)
  const [title, setTitle] = useState(initialTitle ?? '')
  const [newTitle, setNewTitle] = useState('')
  const [colors] = useState(() => availableColors(usedColors))
  const [color, setColor] = useState(colors[0])
  const [start, setStart] = useState(formatMinutes(startMinutes))
  const [end, setEnd] = useState(formatMinutes(endMinutes % 1440))

  const dailyGoalId = pick.startsWith('d:') ? Number(pick.slice(2)) : null
  const planGoal = pick.startsWith('g:') ? planGoals?.find((g) => g.id === Number(pick.slice(2))) : undefined
  const isFree = pick === FREE

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const startMin = parseTime(start)
    const endMin = end === '00:00' ? 1440 : parseTime(end)
    const target: BlockTarget = planGoal
      ? { kind: 'goal', goal: planGoal }
      : pick === NEW_GOAL
        ? { kind: 'new', title: newTitle.trim(), color }
        : null
    onSubmit(
      {
        dailyGoalId,
        // 할 일 블록이면 제목은 그 시간의 주제(1-4f ㊽). 비우면 없음
        title: title.trim() || null,
        date,
        startAt: seoulIso(date, startMin),
        endAt: seoulIso(date, endMin),
      },
      target,
    )
  }

  return (
    <form className="inline-form block-form" onSubmit={submit}>
      <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="무엇을 할까요">
        {goals.length > 0 && (
          <optgroup label="이 날의 할 일">
            {goals.map((g) => (
              <option key={g.id} value={`d:${g.id}`}>
                {g.content}
              </option>
            ))}
          </optgroup>
        )}
        {planGoals && (
          <optgroup label="목표">
            {planGoals.map((g) => (
              <option key={g.id} value={`g:${g.id}`}>
                {g.title}
              </option>
            ))}
            <option value={NEW_GOAL}>+ 새 목표</option>
          </optgroup>
        )}
        {allowFree && <option value={FREE}>목표 아닌 일정 (밥, 산책 등)</option>}
      </select>
      {pick === NEW_GOAL && (
        <>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="새 목표 이름 (예: 기술 면접 준비)"
            maxLength={50}
            required
            autoFocus
            aria-label="새 목표 이름"
          />
          <div className="quick-add-swatches" role="radiogroup" aria-label="새 목표 색">
            {colors.slice(0, 8).map((c, i) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={c === color}
                aria-label={`색 ${i + 1}`}
                className={c === color ? 'swatch on' : 'swatch'}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </>
      )}
      {!isFree && (
        <TopicField
          categoryId={
            dailyGoalId !== null ? (goals.find((g) => g.id === dailyGoalId)?.category?.id ?? null) : (planGoal?.category.id ?? null)
          }
          value={title}
          onChange={setTitle}
        />
      )}
      {isFree && (
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
