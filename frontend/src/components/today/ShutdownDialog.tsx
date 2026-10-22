import { useEffect, useState } from 'react'
import type { Category } from '../../api/categories'
import { errorMessage } from '../../api/client'
import { moveDailyGoal, type DailyGoal } from '../../api/dailyGoals'
import { formatDuration } from '../../api/focus'
import { CONDITION_LABELS, deleteManualLog, saveDailyLog, type DailyLog, type ManualStudyLog } from '../../api/records'
import { dayLabel, mondayOf, shiftDate } from '../../utils/date'
import CategoryBadge from '../CategoryBadge'
import ManualLogForm from '../ManualLogForm'

const STEPS = ['오늘 결과', '못 끝낸 일', '컨디션·메모'] as const

type Props = {
  date: string
  log: DailyLog | null
  goals: DailyGoal[]
  manualLogs: ManualStudyLog[]
  categories: Category[]
  /** 그날 시간 블록으로 잡은 분 */
  plannedMinutes: number
  run: (action: () => Promise<unknown>) => Promise<boolean>
  onClose: () => void
}

/** 하루 마무리 3단계(docs/design.md 6장 1-4d, Sunsama·Akiflow의 하루 마무리 의식) */
export default function ShutdownDialog({ date, log, goals, manualLogs, categories, plannedMinutes, run, onClose }: Props) {
  const [step, setStep] = useState(0)
  const [kept, setKept] = useState<number[]>([])
  const [condition, setCondition] = useState<number | null>(log?.condition ?? null)
  const [memo, setMemo] = useState(log?.memo ?? '')
  const [error, setError] = useState<string | null>(null)
  const tomorrow = shiftDate(date, 1)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const s = log?.summary
  const done = goals.filter((g) => g.status === 'DONE')
  const pending = goals.filter((g) => g.status === 'TODO' && !kept.includes(g.id))
  // 다음 주로 넘어가면 주간 목표를 골라야 해서 여기서는 같은 주일 때만 바로 넘긴다
  const sameWeek = mondayOf(tomorrow) === mondayOf(date)

  const toTomorrow = async (g: DailyGoal) => {
    setError(null)
    try {
      await run(() => moveDailyGoal(g.id, tomorrow))
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const finish = async () => {
    const ok = await run(() => saveDailyLog(date, { memo: memo.trim() || null, condition }))
    if (ok) onClose()
  }

  return (
    <div className="wizard-backdrop" onClick={onClose}>
      <div className="card wizard shutdown" role="dialog" aria-label="하루 마무리" onClick={(e) => e.stopPropagation()}>
        <div className="goal-header">
          <h2 className="goal-title">하루 마무리 · {dayLabel(date)}</h2>
          <button className="icon" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <ol className="wizard-steps">
          {STEPS.map((label, i) => (
            <li key={label} className={i === step ? 'active' : i < step ? 'passed' : ''}>
              <button className="ghost" onClick={() => setStep(i)}>
                {i + 1}. {label}
              </button>
            </li>
          ))}
        </ol>
        {error && <p className="error">{error}</p>}

        <div className="wizard-body">
          {step === 0 && s && (
            <>
              <div className="stat-cards">
                <div className="card stat-card">
                  <span className="muted small">완료한 목표</span>
                  <strong className="stat-value">
                    {s.goalsDone}/{s.goalsTotal}
                  </strong>
                </div>
                <div className="card stat-card">
                  <span className="muted small">공부 (집중 + 수동)</span>
                  <strong className="stat-value">{formatDuration(s.focusSeconds + s.manualMinutes * 60)}</strong>
                </div>
                <div className="card stat-card">
                  <span className="muted small">딴짓</span>
                  <strong className="stat-value">{formatDuration(s.distractionSeconds)}</strong>
                </div>
              </div>
              <p className="muted small">
                시간표에 잡은 {formatDuration(plannedMinutes * 60)} 중 집중 {formatDuration(s.focusSeconds)} ({s.sessionCount}회)
              </p>
              {done.length > 0 && (
                <ul className="note-list">
                  {done.map((g) => (
                    <li key={g.id}>✓ {g.content}</li>
                  ))}
                </ul>
              )}
            </>
          )}

          {step === 1 &&
            (pending.length === 0 ? (
              <p className="muted">못 끝낸 일이 없어요. 다음 단계로 가요.</p>
            ) : (
              <>
                <p className="muted small">오늘 못 끝낸 목표예요. 내일로 넘기거나 그대로 둬요.</p>
                <ul className="unfinished-list">
                  {pending.map((g) => (
                    <li key={g.id}>
                      <span>{g.content}</span>
                      {g.category && <CategoryBadge name={g.category.name} color={g.category.color} />}
                      <span className="row-actions">
                        {sameWeek ? (
                          <button onClick={() => toTomorrow(g)}>내일로</button>
                        ) : (
                          <span className="muted small">다음 주로는 목표 줄의 ⋯ 메뉴에서 옮겨요</span>
                        )}
                        <button className="ghost" onClick={() => setKept([...kept, g.id])}>
                          그대로 두기
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ))}

          {step === 2 && (
            <>
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
                onChange={(e) => setMemo(e.target.value)}
                placeholder="오늘 잘된 점, 막힌 점"
                maxLength={2000}
              />
              <h4 className="log-subtitle">타이머 없이 한 공부</h4>
              {manualLogs.length > 0 && (
                <ul className="unfinished-list">
                  {manualLogs.map((m) => (
                    <li key={m.id}>
                      <CategoryBadge name={m.category.name} color={m.category.color} inactive={!m.category.active} />
                      <span>{m.minutes}분</span>
                      {m.memo && <span className="muted small">{m.memo}</span>}
                      <button className="danger" onClick={() => run(() => deleteManualLog(m.id))}>
                        삭제
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <ManualLogForm date={date} categories={categories} run={run} />
            </>
          )}
        </div>

        <div className="wizard-nav">
          <button className="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
            ‹ 이전
          </button>
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(step + 1)}>다음 ›</button>
          ) : (
            <button onClick={finish}>마무리 ✓</button>
          )}
        </div>
      </div>
    </div>
  )
}
