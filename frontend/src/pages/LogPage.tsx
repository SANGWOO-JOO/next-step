import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { formatDuration } from '../api/focus'
import { CONDITION_LABELS, getDailyLogs, type DailyLog } from '../api/records'
import { getMonthlyReviews, getWeeklyJournals, type MonthlyReviewBrief, type WeeklyJournalBrief } from '../api/reviews'
import { addMonths, currentMonthSeoul, dayLabel, mondaysOfMonth, monthLabel, weekLabel } from '../utils/date'
import { monthRange } from '../utils/health'

type Kind = 'day' | 'week' | 'month'
const KIND_LABELS: Record<Kind, string> = { day: '하루', week: '주간', month: '월간' }

/**
 * 기록(docs/design.md 6장 5-1, Sunsama의 Daily Highlights 방식): 하루 마무리 기록을 최신순 카드로 쌓아 본다.
 * [하루][주간][월간]으로 주간 일지·월간 회고도 같은 형식으로 모아 본다.
 */
export default function LogPage() {
  const [params, setParams] = useSearchParams()
  const kind: Kind = params.get('kind') === 'week' || params.get('kind') === 'month' ? (params.get('kind') as Kind) : 'day'
  const month = params.get('month') ?? currentMonthSeoul()
  const year = month.slice(0, 4)
  const set = (k: Kind, m: string) => setParams({ kind: k, month: m })

  const [days, setDays] = useState<DailyLog[] | null>(null)
  const [weeks, setWeeks] = useState<WeeklyJournalBrief[] | null>(null)
  const [months, setMonths] = useState<MonthlyReviewBrief[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    const fail = (e: unknown) => setError(errorMessage(e))
    if (kind === 'day') {
      const { from, to } = monthRange(month)
      getDailyLogs(from, to).then(setDays).catch(fail)
    } else if (kind === 'week') {
      const mondays = mondaysOfMonth(month)
      getWeeklyJournals(mondays[0], mondays[mondays.length - 1])
        .then((list) => setWeeks([...list].reverse()))
        .catch(fail)
    } else {
      getMonthlyReviews(`${year}-01`, `${year}-12`)
        .then((list) => setMonths([...list].reverse()))
        .catch(fail)
    }
  }, [kind, month, year])

  const move = (delta: number) => set(kind, kind === 'month' ? `${Number(year) + delta}-${month.slice(5)}` : addMonths(month, delta))
  const list = kind === 'day' ? days : kind === 'week' ? weeks : months

  return (
    <section>
      <div className="plan-header">
        <h1 className="log-title">기록</h1>
        <span className="segmented" role="group" aria-label="기록 종류">
          {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
            <button key={k} className={kind === k ? 'active' : ''} onClick={() => set(k, month)}>
              {KIND_LABELS[k]}
            </button>
          ))}
        </span>
        <span className="row-actions">
          <button className="icon" onClick={() => move(-1)} aria-label="이전">
            ‹
          </button>
          <strong className="log-period">{kind === 'month' ? `${year}년` : monthLabel(month)}</strong>
          <button className="icon" onClick={() => move(1)} aria-label="다음">
            ›
          </button>
        </span>
      </div>
      <p className="muted">하루 마무리, 주간 일지, 월간 회고를 최신순으로 모아 봐요.</p>
      {error && <p className="error-banner">{error}</p>}

      {list === null ? (
        <p className="muted">불러오는 중…</p>
      ) : list.length === 0 ? (
        <div className="card empty-cta">
          <p className="muted">
            {kind === 'day'
              ? '이 달에는 기록이 없어요. 하루를 마무리하면 여기에 쌓여요.'
              : kind === 'week'
                ? '이 달에는 주간 일지가 없어요.'
                : '이 해에는 월간 회고가 없어요.'}
          </p>
          <Link className="button-link" to={kind === 'day' ? '/' : kind === 'week' ? '/plan?level=week' : '/plan?level=month'}>
            {kind === 'day' ? '일정에서 하루 마무리하기' : kind === 'week' ? '이번 주 일지 쓰러 가기' : '이번 달 회고 쓰러 가기'}
          </Link>
        </div>
      ) : (
        <div className="log-list">
          {kind === 'day' && days?.map((d) => <DayCard key={d.date} log={d} />)}
          {kind === 'week' &&
            weeks?.map((w) => (
              <article key={w.weekStart} className="card log-card">
                <h3 className="timeline-title">{weekLabel(w.weekStart)}</h3>
                <Lines items={[['잘한 점', w.good], ['아쉬운 점', w.bad], ['다음 주 반영', w.nextAction]]} />
              </article>
            ))}
          {kind === 'month' &&
            months?.map((m) => (
              <article key={m.month} className="card log-card">
                <h3 className="timeline-title">{monthLabel(m.month)}</h3>
                <Lines items={[['회고', m.review], ['다음 달 방향', m.nextDirection]]} />
              </article>
            ))}
        </div>
      )}
    </section>
  )
}

function DayCard({ log }: { log: DailyLog }) {
  const s = log.summary
  return (
    <article className="card log-card">
      <div className="daily-panel-head">
        <h3 className="timeline-title">
          {dayLabel(log.date)} {log.condition && <span title={`컨디션 ${log.condition}`}>{CONDITION_LABELS[log.condition]}</span>}
        </h3>
        {!log.saved && <span className="muted small">마무리 안 함</span>}
      </div>
      <p className="log-stats-line small">
        공부 <strong>{formatDuration(s.focusSeconds + s.manualMinutes * 60)}</strong> · 집중 {s.sessionCount}회 · 딴짓{' '}
        {formatDuration(s.distractionSeconds)} · 목표 {s.goalsDone}/{s.goalsTotal}
      </p>
      {log.doneGoals.length > 0 && (
        <ul className="note-list">
          {log.doneGoals.map((g) => (
            <li key={g}>✓ {g}</li>
          ))}
        </ul>
      )}
      {log.memo && <p className="log-memo">{log.memo}</p>}
    </article>
  )
}

function Lines({ items }: { items: [string, string | null][] }) {
  return (
    <dl className="review-read">
      {items
        .filter(([, v]) => v)
        .map(([label, v]) => (
          <div key={label}>
            <dt className="muted small">{label}</dt>
            <dd>{v}</dd>
          </div>
        ))}
    </dl>
  )
}
