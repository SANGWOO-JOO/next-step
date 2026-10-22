import { useState, type FormEvent } from 'react'
import type { Category } from '../api/categories'
import { createManualLog } from '../api/records'

type Props = {
  date: string
  categories: Category[]
  run: (action: () => Promise<unknown>) => Promise<boolean>
}

/** 타이머 없이 한 공부(책, 오프라인 스터디 등) 추가 폼 */
export default function ManualLogForm({ date, categories, run }: Props) {
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
