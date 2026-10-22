import { useEffect, useState, type FormEvent } from 'react'

type Field = { key: string; label: string; placeholder: string; rows?: number }

type Props = {
  fields: Field[]
  values: Record<string, string | null>
  /** 서버 값이 바뀌었는지 알려 입력란을 다시 맞춘다 */
  version: string
  aiSummary: string | null
  onSave: (values: Record<string, string | null>) => Promise<boolean>
}

/** 주간 일지·월간 회고처럼 글 칸 여러 개를 한 번에 저장하는 폼 */
export default function ReviewFields({ fields, values, version, aiSummary, onSave }: Props) {
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setDraft(Object.fromEntries(fields.map((f) => [f.key, values[f.key] ?? ''])))
    // version이 바뀔 때만 서버 값으로 맞춘다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const cleaned = Object.fromEntries(fields.map((f) => [f.key, draft[f.key]?.trim() || null]))
    onSave(cleaned).then((ok) => ok && setMessage('저장했어요.'))
  }

  return (
    <form className="stack-form" onSubmit={submit}>
      {fields.map((f) => (
        <label key={f.key} className="review-field">
          <span className="small muted">{f.label}</span>
          <textarea
            rows={f.rows ?? 3}
            value={draft[f.key] ?? ''}
            placeholder={f.placeholder}
            maxLength={f.rows && f.rows > 3 ? 4000 : 2000}
            onChange={(e) => {
              setDraft({ ...draft, [f.key]: e.target.value })
              setMessage(null)
            }}
          />
        </label>
      ))}
      <span className="inline-form">
        <button type="submit">저장</button>
        {message && <span className="muted small">{message}</span>}
      </span>
      <p className="muted small">AI 요약: {aiSummary ?? '2단계에서 추가돼요.'}</p>
    </form>
  )
}
