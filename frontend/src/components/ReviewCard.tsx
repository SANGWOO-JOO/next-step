import { useState } from 'react'
import ReviewFields from './ReviewFields'

type Field = { key: string; label: string; placeholder: string; rows?: number }

type Props = {
  title: string
  fields: Field[]
  values: Record<string, string | null>
  /** 서버 값이 바뀌었는지 알리는 값(ReviewFields에 넘김) */
  version: string
  /** 접힌 안내에 쓰는 이름(날짜 없이). 예: 이번 주 일지 */
  name: string
  aiSummary: string | null
  /** 이미 저장했으면 글로 보여주고 [수정] */
  saved: boolean
  /** 쓸 때(주 끝·달 끝·지난 기간)면 펼친 채로 시작 */
  due: boolean
  /** 펼쳤을 때 위에 보여줄 안내 */
  prompt?: string
  onSave: (values: Record<string, string | null>) => Promise<boolean>
}

/**
 * 회고 카드(docs/design.md 1-4c 회고 위치). 평소에는 한 줄로 접고, 쓸 때만 펼친다.
 * 쓴 회고는 입력란 대신 글로 보여준다.
 */
export default function ReviewCard({ title, name, fields, values, version, aiSummary, saved, due, prompt, onSave }: Props) {
  const [mode, setMode] = useState<'collapsed' | 'read' | 'edit'>(saved ? 'read' : due ? 'edit' : 'collapsed')

  if (mode === 'collapsed') {
    return (
      <div className="card review-collapsed">
        <span className="muted small">{name}는 기간 끝에 써요.</span>
        <button className="ghost" onClick={() => setMode('edit')}>
          {name} 쓰기
        </button>
      </div>
    )
  }

  if (mode === 'read') {
    return (
      <div className="card">
        <div className="daily-panel-head">
          <h3 className="timeline-title">{title}</h3>
          <button className="ghost" onClick={() => setMode('edit')}>
            수정
          </button>
        </div>
        <dl className="review-read">
          {fields
            .filter((f) => values[f.key])
            .map((f) => (
              <div key={f.key}>
                <dt className="muted small">{f.label}</dt>
                <dd>{values[f.key]}</dd>
              </div>
            ))}
        </dl>
        {aiSummary && <p className="muted small">AI 요약: {aiSummary}</p>}
      </div>
    )
  }

  return (
    <div className="card">
      <div className="daily-panel-head">
        <h3 className="timeline-title">{title}</h3>
        {!due && !saved && (
          <button className="ghost" onClick={() => setMode('collapsed')}>
            접기
          </button>
        )}
      </div>
      {prompt && <p className="notice small">{prompt}</p>}
      <ReviewFields
        fields={fields}
        values={values}
        version={version}
        aiSummary={aiSummary}
        onSave={(v) =>
          onSave(v).then((ok) => {
            if (ok && Object.values(v).some(Boolean)) setMode('read')
            return ok
          })
        }
      />
    </div>
  )
}
