import { useEffect, useId, useRef, useState } from 'react'
import { errorMessage } from '../api/client'
import { CONDITION_NAMES, getDailyLog, saveDailyLog } from '../api/records'
import { dayLabel, todaySeoul } from '../utils/date'
import { refreshReminders } from '../utils/reminders'
import ConditionFace from './ConditionFace'

/** 회고 페이지에서는 컨디션과 메모만 작성한다. 일정의 하루 마무리와 같은 일일 기록을 저장한다. */
export default function DailyReflectionDialog({ date, onClose }: { date: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const memoInput = useRef<HTMLTextAreaElement>(null)
  const titleId = useId()
  const conditionName = useId()
  const [condition, setCondition] = useState<number | null>(null)
  const [memo, setMemo] = useState('')
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const element = dialog.current
    const previousFocus = document.activeElement
    element?.showModal()
    return () => {
      element?.close()
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [])

  useEffect(() => {
    let active = true
    getDailyLog(date).then(log => {
      if (!active) return
      setLoaded(true)
      setCondition(log.condition)
      setMemo(log.memo ?? '')
      setLoading(false)
    }).catch(e => {
      if (!active) return
      setError(errorMessage(e))
      setLoading(false)
    })
    return () => { active = false }
  }, [date, attempt])

  useEffect(() => {
    if (!loading && !error) memoInput.current?.focus()
  }, [loading, error])

  return <dialog ref={dialog} className="daily-reflection-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <header className="daily-reflection-head"><div><h2 id={titleId}>{date === todaySeoul() ? '오늘 회고' : '하루 회고'}</h2><p>{dayLabel(date)}</p></div><button type="button" className="icon" aria-label="회고 닫기" disabled={busy} onClick={onClose}>×</button></header>
    {loading ? <p className="muted" role="status">회고를 불러오는 중이에요.</p> : <form onSubmit={async event => {
      event.preventDefault()
      if (busy || !loaded) return
      setBusy(true)
      setError(null)
      try {
        await saveDailyLog(date, { memo: memo.trim() || null, condition })
        refreshReminders()
        onClose()
      } catch (e) {
        setError(errorMessage(e))
        setBusy(false)
      }
    }}>
      {loaded ? <>
        <p className="daily-reflection-intro">하루의 기분과 기억하고 싶은 일을 짧게 남겨보세요.</p>
        <fieldset className="daily-reflection-condition" disabled={busy}><legend>컨디션 <span className="muted small">선택</span></legend><div className="daily-condition-options">{[1, 2, 3, 4, 5].map(value => <label key={value} className={`daily-condition-option${condition === value ? ' selected' : ''}`}><input type="radio" name={conditionName} value={value} checked={condition === value} onChange={() => setCondition(value)} /><span aria-hidden="true"><ConditionFace value={value} size={30} /></span><span>{CONDITION_NAMES[value]}</span></label>)}</div>{condition !== null && <button type="button" className="ghost small" onClick={() => setCondition(null)}>선택 해제</button>}</fieldset>
        <label className="daily-reflection-memo">하루를 돌아보며<textarea ref={memoInput} rows={4} maxLength={2000} disabled={busy} value={memo} onChange={event => setMemo(event.target.value)} placeholder="오늘 잘한 일이나 아쉬웠던 일, 내일 해보고 싶은 일을 적어보세요." /></label>
        <div className="daily-reflection-count muted small">{memo.length} / 2,000</div>
      </> : <button type="button" className="ghost" onClick={() => { setLoading(true); setError(null); setAttempt(value => value + 1) }}>다시 불러오기</button>}
      {error && <p className="error" role="alert">{error}</p>}
      <footer className="daily-reflection-actions"><button type="button" className="ghost" disabled={busy} onClick={onClose}>취소</button>{loaded && <button type="submit" disabled={busy}>{busy ? '저장 중…' : '회고 저장'}</button>}</footer>
    </form>}
  </dialog>
}
