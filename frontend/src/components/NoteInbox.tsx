import { useCallback, useEffect, useState } from 'react'
import { errorMessage } from '../api/client'
import { checkDistractionNote, getDistractionNotes, type DistractionNote } from '../api/focus'

/** 지난 집중 세션에서 남긴 확인 안 한 딴생각 메모(1-4e부터 기록 페이지에서 확인). 없으면 보이지 않는다. */
export default function NoteInbox() {
  const [notes, setNotes] = useState<DistractionNote[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    getDistractionNotes(false)
      .then(setNotes)
      .catch((e) => setError(errorMessage(e)))
  }, [])
  useEffect(load, [load])

  const check = (id: number) =>
    checkDistractionNote(id, true)
      .then(load)
      .catch((e) => setError(errorMessage(e)))

  if (notes.length === 0 && !error) return null
  return (
    <div className="card" id="notes">
      <h3 className="timeline-title">확인 안 한 딴생각 메모 {notes.length}개</h3>
      {error && <p className="error">{error}</p>}
      <ul className="unfinished-list">
        {notes.map((n) => (
          <li key={n.id}>
            <span>{n.content}</span>
            <span className="muted small">
              {n.sessionDate.slice(5).replace('-', '/')}
              {n.dailyGoalContent && ` · ${n.dailyGoalContent}`}
            </span>
            <button className="ghost" onClick={() => check(n.id)}>
              확인
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
