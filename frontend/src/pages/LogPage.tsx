import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { formatDuration } from '../api/focus'
import { CONDITION_LABELS, getDailyLogs, type DailyLog } from '../api/records'
import NoteInbox from '../components/NoteInbox'
import ReviewWriter from '../components/ReviewWriter'
import IconButton from '../components/IconButton'
import chevronLeft from '../assets/icons/chevron-left.svg'
import chevronRight from '../assets/icons/chevron-right.svg'
import DayWrapUp from '../components/today/DayWrapUp'
import { getMonthlyReviews, getWeeklyJournals, type MonthlyReviewBrief, type WeeklyJournalBrief } from '../api/reviews'
import { addMonths, currentMonthSeoul, dayLabel, mondayOf, mondaysOfMonth, monthLabel, shiftDate, todaySeoul, weekLabel } from '../utils/date'
import { monthRange } from '../utils/health'

type Kind = 'day' | 'week' | 'month'
const KIND_LABELS: Record<Kind, string> = { day: '일', week: '주', month: '월' }

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
  /** 달력에서 고른 날. 기본은 오늘(이 달이 아니면 그 달의 마지막 기록 또는 1일) */
  const [pickedDate, setPickedDate] = useState<string | null>(null)
  /** 일지·회고를 저장하면 목록을 다시 불러온다 */
  const [version, setVersion] = useState(0)
  /** 하루 마무리 창을 연 날짜 */
  const [wrapDate, setWrapDate] = useState<string | null>(null)

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
  }, [kind, month, year, version])

  const move = (delta: number) => set(kind, kind === 'month' ? `${Number(year) + delta}-${month.slice(5)}` : addMonths(month, delta))
  const list = kind === 'week' ? weeks : months
  // 처음엔 아무 날도 고르지 않는다(1-4f ㉔). 다른 달로 가면 닫힌다
  const picked = pickedDate && pickedDate.startsWith(month) ? pickedDate : null

  return (
    <section>
      {/* 다른 화면과 같은 머리: 왼쪽 ‹ › 기간, 오른쪽 [하루|주간|월간](1-4f ㉒) */}
      <div className="cal-header">
        <span className="cal-nav">
          <IconButton icon={chevronLeft} label={kind === 'month' ? '이전 해' : '이전 달'} onClick={() => move(-1)} />
          <IconButton icon={chevronRight} label={kind === 'month' ? '다음 해' : '다음 달'} onClick={() => move(1)} />
          <h1 className="cal-title">{kind === 'month' ? `${year}년` : monthLabel(month)}</h1>
        </span>
        <span className="segmented" role="group" aria-label="기록 종류">
          {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
            <button key={k} className={kind === k ? 'active' : ''} onClick={() => set(k, month)}>
              {KIND_LABELS[k]}
            </button>
          ))}
        </span>
      </div>
      {error && <p className="error-banner">{error}</p>}
      {kind === 'day' && <NoteInbox />}
      {kind !== 'day' && <ReviewWriter key={kind} kind={kind} onSaved={() => setVersion((v) => v + 1)} />}

      {kind === 'day' && days && (
        <LogCalendar
          month={month}
          days={days}
          picked={picked}
          onPick={setPickedDate}
          onWrite={(date) => {
            setPickedDate(null)
            setWrapDate(date)
          }}
        />
      )}
      {kind !== 'day' && (list === null ? (
        <p className="muted">불러오는 중…</p>
      ) : list.length === 0 ? (
        <div className="card empty-cta">
          <p className="muted">{kind === 'week' ? '이 달에는 주간 일지가 없어요.' : '이 해에는 월간 회고가 없어요.'}</p>
        </div>
      ) : (
        <div className="log-list">
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
      ))}
      {wrapDate && (
        <DayWrapUp
          date={wrapDate}
          onClose={() => {
            setWrapDate(null)
            setVersion((v) => v + 1)
          }}
        />
      )}
    </section>
  )
}

/** 고른 날의 기록 한 장(1-4f ㉒): 컨디션 → 메모 → 계획대로·실제 공부 → 완료 목표 → 버튼 하나 */
function DayDetail({ date, log, onWrite, onClose }: { date: string; log: DailyLog | undefined; onWrite: () => void; onClose: () => void }) {
  const future = date > todaySeoul()
  const plan = log?.summary.plan
  return (
    <article className="log-detail">
      <div className="log-detail-head">
        <h2 className="log-detail-date">{dayLabel(date)}</h2>
        {log?.condition && (
          <span className="log-detail-mood" title={`컨디션 ${log.condition}`}>
            {CONDITION_LABELS[log.condition]}
          </span>
        )}
        <button className="icon log-detail-close" onClick={onClose} aria-label="닫기">
          ×
        </button>
      </div>
      {!log || (!log.saved && !log.summary.studySeconds && !log.summary.goalsTotal) ? (
        <p className="muted">{future ? '아직 오지 않은 날이에요.' : '아직 이날의 기록이 없어요.'}</p>
      ) : (
        <>
          {log.memo && <p className="log-memo">{log.memo}</p>}
          {plan && (plan.plannedMinutes > 0 || log.summary.studySeconds > 0) && (
            <p className="log-detail-line">
              {plan.asPlannedPercent != null && (
                <>
                  계획대로 <b>{plan.asPlannedPercent}%</b> ·{' '}
                </>
              )}
              실제 공부 <b>{formatDuration(log.summary.studySeconds)}</b>
              <span className="muted"> / 계획 {formatDuration(plan.plannedMinutes * 60)}</span>
            </p>
          )}
          {log.doneGoals.length > 0 ? (
            <ul className="note-list">
              {log.doneGoals.map((g) => (
                <li key={g}>✓ {g}</li>
              ))}
            </ul>
          ) : (
            <p className="muted small">완료한 목표 0/{log.summary.goalsTotal}</p>
          )}
        </>
      )}
      {!future && (
        <span className="log-cta">
          {log?.saved ? (
            <button className="ghost" onClick={onWrite}>
              고치기
            </button>
          ) : (
            <button onClick={onWrite}>하루 마무리 쓰기</button>
          )}
        </span>
      )}
    </article>
  )
}

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']

/** 달력 색 단계(범례용). 색은 그달 최대 공부 시간 대비 비율로 칠한다 */
const LEVELS: { label: string; ratio: number; range: (max: number) => string }[] = [
  { label: '없음', ratio: 0, range: () => '' },
  { label: '조금', ratio: 0.2, range: (max) => `~${formatDuration(max / 3)}` },
  { label: '보통', ratio: 0.55, range: (max) => `${formatDuration(max / 3)}~${formatDuration((max * 2) / 3)}` },
  { label: '많이', ratio: 1, range: (max) => `${formatDuration((max * 2) / 3)} 이상` },
]

/**
 * 기록 달력(1-4f ㉔, Day One 달력·Google Calendar 월 보기 클릭 참고): 전체 폭, 칸 안에 컨디션·공부 시간·계획대로 %.
 * 날짜를 누르면 그 칸 옆에 팝오버(좁은 화면은 아래 시트). 공부량은 브랜드 보라 농도
 */
function LogCalendar({
  month,
  days,
  picked,
  onPick,
  onWrite,
}: {
  month: string
  days: DailyLog[]
  picked: string | null
  onPick: (date: string | null) => void
  onWrite: (date: string) => void
}) {
  const byDate = new Map(days.map((d) => [d.date, d]))
  const max = Math.max(1, ...days.map((d) => d.summary.studySeconds))
  const { from, to } = monthRange(month)
  const start = mondayOf(from)
  const cells: string[] = []
  for (let d = start; d <= to || cells.length % 7 !== 0; d = shiftDate(d, 1)) cells.push(d)
  const today = todaySeoul()
  const gridRef = useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = useState<{ top: number; left: number; side: 'right' | 'left' } | null>(null)

  // 바깥을 누르거나 Esc를 누르면 닫는다
  useEffect(() => {
    if (!picked) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onPick(null)
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest('.log-day-popover') && !t.closest('.log-cal-cell')) onPick(null)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [picked, onPick])

  const pick = (date: string, el: HTMLElement) => {
    if (picked === date) {
      onPick(null)
      return
    }
    const grid = gridRef.current!.getBoundingClientRect()
    const cell = el.getBoundingClientRect()
    // 오른쪽에 자리가 있으면 칸 오른쪽, 아니면 왼쪽에 띄운다
    const side = cell.right + 300 < grid.right ? 'right' : 'left'
    setAnchor({ top: cell.top - grid.top, left: side === 'right' ? cell.right - grid.left + 8 : cell.left - grid.left - 8, side })
    onPick(date)
  }

  const pickedLog = picked ? byDate.get(picked) : undefined

  return (
    <div className="card log-calendar">
      <div className="log-cal-grid" ref={gridRef}>
        {WEEKDAYS.map((w) => (
          <span key={w} className="muted small log-cal-head">
            {w}
          </span>
        ))}
        {cells.map((date) => {
          const log = byDate.get(date)
          const seconds = log ? log.summary.studySeconds : 0
          const percent = log?.summary.plan.asPlannedPercent
          const inMonth = date.startsWith(month)
          return (
            <button
              key={date}
              type="button"
              className={[
                'log-cal-cell',
                inMonth ? '' : 'outside',
                date === today ? 'today' : '',
                log ? 'has' : '',
                date === picked ? 'picked' : '',
              ].join(' ')}
              onClick={(e) => pick(date, e.currentTarget)}
              aria-label={log ? `${dayLabel(date)} · 공부 ${formatDuration(seconds)}` : dayLabel(date)}
              style={
                seconds > 0
                  ? { background: `color-mix(in srgb, var(--study) ${Math.round(18 + (seconds / max) * 62)}%, transparent)` }
                  : undefined
              }
            >
              <span className="log-cal-top">
                <span className="log-cal-date">{Number(date.slice(8))}</span>
                <span className="log-cal-mood">{log?.condition ? CONDITION_LABELS[log.condition] : ''}</span>
              </span>
              {seconds > 0 && <span className="log-cal-study">{formatDuration(seconds)}</span>}
              {percent != null && <span className="log-cal-plan">계획대로 {percent}%</span>}
            </button>
          )
        })}
        {picked && anchor && (
          <div
            className={`log-day-popover side-${anchor.side}`}
            style={{ top: anchor.top, left: anchor.left }}
            role="dialog"
            aria-label={`${dayLabel(picked)} 기록`}
          >
            <DayDetail date={picked} log={pickedLog} onWrite={() => onWrite(picked)} onClose={() => onPick(null)} />
          </div>
        )}
      </div>
      {/* 안내 글자에 마우스를 올리거나 포커스하면 색 단계 범례가 보인다 */}
      <p className="muted small log-cal-hint" tabIndex={0}>
        날짜를 누르면 그날 기록을 봐요. 색이 진할수록 공부를 많이 한 날이에요.
        <span className="log-cal-legend" role="tooltip">
          <span className="log-cal-legend-title">색 단계 (이 달 가장 많이 공부한 날 {formatDuration(max)} 기준)</span>
          {LEVELS.map((l) => (
            <span key={l.label} className="log-cal-legend-row">
              <span
                className="log-cal-legend-swatch"
                style={{
                  background: l.ratio === 0 ? 'transparent' : `color-mix(in srgb, var(--study) ${Math.round(18 + l.ratio * 62)}%, transparent)`,
                }}
              />
              <span>{l.label}</span>
              <span className="muted">{l.ratio === 0 ? '기록 없음' : l.range(max)}</span>
            </span>
          ))}
        </span>
      </p>
    </div>
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
