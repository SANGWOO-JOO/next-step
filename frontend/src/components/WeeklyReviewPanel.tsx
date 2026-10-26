import { useId, type ReactNode } from 'react'

export default function WeeklyReviewPanel({ title, period, kind, expanded, onCollapse, children }: {
  title: string; period: string; kind: 'journal' | 'feedback'; expanded: boolean; onCollapse: () => void; children: ReactNode
}) {
  const titleId = useId()
  return <section className="card weekly-review-panel" aria-labelledby={titleId}>
    <header className="weekly-review-head">
      <span className="weekly-review-icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{kind === 'journal' ? <><path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Z" /><path d="M8 4v16M11 8h5M11 12h5M11 16h3" /></> : <><path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z" /><path d="m19 3 .6 1.4L21 5l-1.4.6L19 7l-.6-1.4L17 5l1.4-.6L19 3Z" /></>}</svg></span>
      <div className="weekly-review-heading"><h3 id={titleId}>{title}</h3><p>{period}</p></div>
      {expanded && <button type="button" className="ghost weekly-review-collapse" aria-label={`${title} 접기`} aria-expanded={true} onClick={onCollapse}>접기 <span aria-hidden="true">⌃</span></button>}
    </header>
    {children}
  </section>
}
