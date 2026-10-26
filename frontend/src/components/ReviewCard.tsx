import { useState } from 'react'
import ReviewFields from './ReviewFields'
import WeeklyReviewPanel from './WeeklyReviewPanel'

type Field = { key: string; label: string; placeholder: string; rows?: number }

type Props = {
  title: string
  period: string
  fields: Field[]
  values: Record<string, string | null>
  /** 서버 값이 바뀌었는지 알리는 값(ReviewFields에 넘김) */
  version: string
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
export default function ReviewCard({ title, period, fields, values, version, aiSummary, saved, due, prompt, onSave }: Props) {
  const [mode, setMode] = useState<'collapsed' | 'read' | 'edit'>(!saved && due ? 'edit' : 'collapsed')
  const summary = fields.map(field => values[field.key]).find(Boolean)
  return <WeeklyReviewPanel title={title} period={period} kind="journal" expanded={mode !== 'collapsed'} onCollapse={() => setMode('collapsed')}>
    {mode === 'collapsed' && <>
      <p className="weekly-review-preview">{saved ? summary || '이번 주 일지를 남겼어요.' : '잘한 점과 아쉬운 점을 적고, 다음 주를 준비해요.'}</p>
      <footer className="weekly-review-actions"><span className="muted small">{saved ? '작성 완료' : '아직 작성하지 않았어요'}</span><button type="button" aria-expanded={false} onClick={() => setMode(saved ? 'read' : 'edit')}>{saved ? '일지 보기' : '일지 쓰기'}</button></footer>
    </>}
    {mode === 'read' && <div className="weekly-review-content">
      <dl className="review-read">{fields.filter(field => values[field.key]).map(field => <div key={field.key}><dt className="muted small">{field.label}</dt><dd>{values[field.key]}</dd></div>)}</dl>
      {aiSummary && <p className="muted small">AI 요약: {aiSummary}</p>}
      <footer className="weekly-review-actions"><button type="button" className="ghost" onClick={() => setMode('edit')}>일지 수정</button></footer>
    </div>}
    <div className="weekly-review-content" hidden={mode !== 'edit'}>
      {prompt && <p className="notice small">{prompt}</p>}
      <ReviewFields fields={fields} values={values} version={version} aiSummary={aiSummary} onSave={v => onSave(v).then(ok => { if (ok && Object.values(v).some(Boolean)) setMode('read'); return ok })} />
    </div>
  </WeeklyReviewPanel>
}
