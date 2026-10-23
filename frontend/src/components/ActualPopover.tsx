import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import {
  ACTUAL_KIND_LABELS,
  createActualLog,
  deleteActualLog,
  getDistractionTitles,
  updateActualLog,
  type ActualKind,
  type ActualLog,
} from '../api/actualLogs'
import type { Category } from '../api/categories'
import type { DailyGoal } from '../api/dailyGoals'
import { dayLabel, formatMinutes, parseTime, seoulIso } from '../utils/date'

type Props = {
  date: string
  /** 새로 적을 때의 범위(분) */
  start: number
  end: number
  /** 고칠 기록. 없으면 새로 적는다 */
  log?: ActualLog
  goals: DailyGoal[]
  categories: Category[]
  run: (action: () => Promise<unknown>) => Promise<boolean>
  onClose: () => void
  style: CSSProperties
}

/** 실제 줄에 "그 시간에 무엇을 했나요?"를 적는 창(docs/design.md 1-4e) */
export default function ActualPopover({ date, start, end, log, goals, categories, run, onClose, style }: Props) {
  const firstKind: ActualKind = log?.kind ?? (goals.length ? 'GOAL' : 'STUDY')
  const [kind, setKind] = useState<ActualKind>(firstKind)
  const [goalId, setGoalId] = useState<number | null>(log?.dailyGoalId ?? goals[0]?.id ?? null)
  const [categoryId, setCategoryId] = useState<number | null>(log?.category?.id ?? categories[0]?.id ?? null)
  const [title, setTitle] = useState(log?.title ?? '')
  const [from, setFrom] = useState(formatMinutes(start))
  const [to, setTo] = useState(formatMinutes(end % 1440))
  const [titles, setTitles] = useState<string[]>([])

  useEffect(() => {
    if (kind !== 'DISTRACTION') return
    getDistractionTitles()
      .then(setTitles)
      .catch(() => setTitles([]))
  }, [kind])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const startMin = parseTime(from)
    const endMin = to === '00:00' ? 1440 : parseTime(to)
    const input = {
      date,
      startAt: seoulIso(date, startMin),
      endAt: seoulIso(date, endMin),
      kind,
      dailyGoalId: kind === 'GOAL' ? goalId : null,
      categoryId: kind === 'STUDY' ? categoryId : null,
      title: kind === 'DISTRACTION' || kind === 'OTHER' || kind === 'STUDY' ? title.trim() || null : null,
    }
    run(() => (log ? updateActualLog(log.id, input) : createActualLog(input))).then((ok) => ok && onClose())
  }

  return (
    <div
      className="schedule-popover card actual-popover"
      style={style}
      onPointerDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-label="실제로 한 일"
    >
      <div className="daily-panel-head">
        <strong className="small">
          {log ? '실제 기록 고치기' : '이 시간에 실제로 한 일'} · {dayLabel(date)}
        </strong>
        <button className="icon" onClick={onClose} aria-label="닫기">
          ×
        </button>
      </div>
      <form className="stack-form" onSubmit={submit}>
        <span className="segmented actual-kinds" role="group" aria-label="종류">
          {(Object.keys(ACTUAL_KIND_LABELS) as ActualKind[]).map((k) => (
            <button
              key={k}
              type="button"
              className={kind === k ? 'active' : ''}
              onClick={() => setKind(k)}
              disabled={k === 'GOAL' && goals.length === 0}
              title={k === 'GOAL' && goals.length === 0 ? '이 날의 하루 목표가 없어요' : undefined}
            >
              {ACTUAL_KIND_LABELS[k]}
            </button>
          ))}
        </span>

        {kind === 'GOAL' && (
          <select value={goalId ?? ''} onChange={(e) => setGoalId(Number(e.target.value))} aria-label="하루 목표">
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.content}
              </option>
            ))}
          </select>
        )}
        {kind === 'STUDY' && (
          <span className="inline-form">
            <select value={categoryId ?? ''} onChange={(e) => setCategoryId(Number(e.target.value))} aria-label="분류">
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="무엇을 (선택)" maxLength={100} />
          </span>
        )}
        {kind === 'DISTRACTION' && (
          <>
            <input
              list="distraction-titles"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 유튜브 (비워도 돼요)"
              maxLength={100}
              autoFocus
            />
            <datalist id="distraction-titles">
              {titles.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </>
        )}
        {kind === 'OTHER' && (
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 점심, 산책" maxLength={100} required autoFocus />
        )}

        <span className="inline-form">
          <input type="time" step={300} value={from} onChange={(e) => setFrom(e.target.value)} required aria-label="시작" />
          ~
          <input type="time" step={300} value={to} onChange={(e) => setTo(e.target.value)} required aria-label="끝" />
        </span>
        <span className="row-actions">
          <button type="submit">{log ? '저장' : '기록'}</button>
          <button type="button" className="ghost" onClick={onClose}>
            취소
          </button>
          {log && (
            <button type="button" className="danger" onClick={() => run(() => deleteActualLog(log.id)).then((ok) => ok && onClose())}>
              삭제
            </button>
          )}
        </span>
        <p className="muted small">겹치는 기존 기록은 잘리고, 바로 붙은 같은 기록은 하나로 합쳐져요.</p>
      </form>
    </div>
  )
}
