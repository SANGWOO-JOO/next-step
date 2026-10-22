import { useEffect, useState, type FormEvent } from 'react'
import type { Category } from '../api/categories'
import { formatDuration } from '../api/focus'
import {
  CONDITION_LABELS,
  createManualLog,
  deleteManualLog,
  saveDailyLog,
  type DailyLog,
  type ManualStudyLog,
} from '../api/records'
import CategoryBadge from './CategoryBadge'

type Props = {
  date: string
  log: DailyLog | null
  manualLogs: ManualStudyLog[]
  categories: Category[]
  run: (action: () => Promise<unknown>) => Promise<boolean>
}

/** 하루 기록: 자동 집계, 컨디션·메모, 타이머 없이 한 공부 */
export default function DailyLogCard({ date, log, manualLogs, categories, run }: Props) {
  const [memo, setMemo] = useState('')
  const [condition, setCondition] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // 서버 값이 바뀌면(저장 후, 날짜 변경) 입력란을 맞춘다
  useEffect(() => {
    setMemo(log?.memo ?? '')
    setCondition(log?.condition ?? null)
  }, [log?.memo, log?.condition, log?.updatedAt])

  const save = (e: FormEvent) => {
    e.preventDefault()
    run(() => saveDailyLog(date, { memo: memo.trim() || null, condition })).then(
      (ok) => ok && setMessage('저장했어요.'),
    )
  }

  const s = log?.summary
  const studySeconds = s ? s.focusSeconds + s.manualMinutes * 60 : 0

  return (
    <div className="card daily-log">
      <h3 className="timeline-title">하루 기록</h3>
      {s && (
        <dl className="result-stats log-stats">
          <dt>공부 합계</dt>
          <dd>{formatDuration(studySeconds)}</dd>
          <dt>집중</dt>
          <dd>
            {formatDuration(s.focusSeconds)} ({s.sessionCount}회)
          </dd>
          <dt>수동 기록</dt>
          <dd>{s.manualMinutes}분</dd>
          <dt>딴짓</dt>
          <dd>{formatDuration(s.distractionSeconds)}</dd>
          <dt>하루 목표</dt>
          <dd>
            {s.goalsDone}/{s.goalsTotal} 완료
          </dd>
        </dl>
      )}

      <form className="stack-form" onSubmit={save}>
        <span className="inline-form condition-picker" role="radiogroup" aria-label="컨디션">
          <span className="muted small">컨디션</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={condition === n}
              aria-label={`컨디션 ${n}`}
              className={condition === n ? 'icon selected' : 'icon'}
              onClick={() => setCondition(condition === n ? null : n)}
            >
              {CONDITION_LABELS[n]}
            </button>
          ))}
        </span>
        <textarea
          rows={3}
          value={memo}
          onChange={(e) => {
            setMemo(e.target.value)
            setMessage(null)
          }}
          placeholder="오늘 어땠나요? 잘된 점, 막힌 점"
          maxLength={2000}
        />
        <span className="inline-form">
          <button type="submit">기록 저장</button>
          {message && <span className="muted small">{message}</span>}
        </span>
      </form>

      <h4 className="log-subtitle">타이머 없이 한 공부</h4>
      {manualLogs.length > 0 && (
        <ul className="unfinished-list">
          {manualLogs.map((m) => (
            <li key={m.id}>
              <CategoryBadge name={m.category.name} color={m.category.color} inactive={!m.category.active} />
              <span>{m.minutes}분</span>
              {m.memo && <span className="muted small">{m.memo}</span>}
              <button
                className="danger"
                onClick={() => confirm('이 기록을 삭제할까요?') && run(() => deleteManualLog(m.id))}
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
      <ManualLogForm date={date} categories={categories} run={run} />
    </div>
  )
}

function ManualLogForm({ date, categories, run }: Omit<Props, 'log' | 'manualLogs'>) {
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [minutes, setMinutes] = useState(30)
  const [memo, setMemo] = useState('')
  const picked = categoryId ?? categories[0]?.id ?? null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (picked === null) return
    run(() => createManualLog({ date, categoryId: picked, minutes, memo: memo.trim() || null })).then(
      (ok) => ok && setMemo(''),
    )
  }

  return (
    <form className="inline-form" onSubmit={submit}>
      <select value={picked ?? ''} onChange={(e) => setCategoryId(Number(e.target.value))} aria-label="분류">
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <label>
        <input
          type="number"
          className="narrow"
          min={1}
          max={600}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          aria-label="분"
        />
        분
      </label>
      <input className="grow" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 책 3장" />
      <button type="submit" disabled={picked === null}>
        추가
      </button>
    </form>
  )
}
