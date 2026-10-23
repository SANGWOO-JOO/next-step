import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { formatDuration } from '../api/focus'
import { CONDITION_LABELS, getDailyLogs, type DailyLog } from '../api/records'
import { getMonthlyReviews, getWeeklyJournals, type MonthlyReviewBrief, type WeeklyJournalBrief } from '../api/reviews'
import { addMonths, currentMonthSeoul, dayLabel, mondayOf, mondaysOfMonth, monthLabel, shiftDate, todaySeoul, weekLabel } from '../utils/date'
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
  const [dayView, setDayView] = useState<'list' | 'calendar'>('list')
  /** 달력에서 고른 날. 목록에서 그 카드로 스크롤하고 강조한다 */
  const [focusDate, setFocusDate] = useState<string | null>(null)

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
          {kind === 'day' && days && (
            <>
              <MonthSummary month={month} days={days} />
              <span className="segmented log-view-toggle" role="group" aria-label="보기 방식">
                {(['list', 'calendar'] as const).map((v) => (
                  <button key={v} className={dayView === v ? 'active' : ''} onClick={() => setDayView(v)}>
                    {v === 'list' ? '목록' : '달력'}
                  </button>
                ))}
              </span>
              {/* 넓은 화면은 목록 + 달력 나란히, 좁으면 전환한 쪽만(CSS) */}
              <div className={`log-day-layout view-${dayView}`}>
                <div className="log-pane-list">
                  {days.map((d) => (
                    <DayCard key={d.date} log={d} focused={d.date === focusDate} />
                  ))}
                </div>
                <div className="log-pane-calendar">
                  <LogCalendar
                    month={month}
                    days={days}
                    focusDate={focusDate}
                    onPick={(date) => {
                      setDayView('list')
                      setFocusDate(date)
                    }}
                  />
                </div>
              </div>
            </>
          )}
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

function DayCard({ log, focused }: { log: DailyLog; focused: boolean }) {
  const s = log.summary
  const ref = useRef<HTMLElement>(null)
  const isToday = log.date === todaySeoul()
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focused])

  return (
    <article ref={ref} className={focused ? 'card log-card timeline focused' : 'card log-card timeline'} id={`log-${log.date}`}>
      <div className="log-date">
        <span className="log-day">{Number(log.date.slice(8))}</span>
        <span className="muted small">{dayLabel(log.date).slice(-3)}</span>
        <span className="log-condition" title={log.condition ? `컨디션 ${log.condition}` : '컨디션 기록 없음'}>
          {log.condition ? CONDITION_LABELS[log.condition] : '·'}
        </span>
      </div>
      <div className="log-body">
        <div className="log-chips">
          <span className="log-chip strong">공부 {formatDuration(s.focusSeconds + s.manualMinutes * 60)}</span>
          <span className="log-chip">집중 {s.sessionCount}회</span>
          {s.distractionSeconds > 0 && <span className="log-chip">딴짓 {formatDuration(s.distractionSeconds)}</span>}
          <span className="log-chip">
            목표 {s.goalsDone}/{s.goalsTotal}
          </span>
        </div>
        {(s.plan.plannedMinutes > 0 || s.plan.actualStudyMinutes > 0) && (
          <p className="muted small log-compare">
            계획 {formatDuration(s.plan.plannedMinutes * 60)} → 실제 공부 {formatDuration(s.plan.actualStudyMinutes * 60)}
            {s.plan.asPlannedPercent != null && ` · 계획대로 ${s.plan.asPlannedPercent}%`}
            {s.plan.actualDistractionMinutes > 0 && ` · 딴짓 ${formatDuration(s.plan.actualDistractionMinutes * 60)}`}
          </p>
        )}
        {log.doneGoals.length > 0 && (
          <ul className="note-list">
            {log.doneGoals.map((g) => (
              <li key={g}>✓ {g}</li>
            ))}
          </ul>
        )}
        {log.memo && <p className="log-memo">{log.memo}</p>}
        {!log.saved &&
          (isToday ? (
            <Link className="button-link log-cta" to="/">
              하루 마무리하기
            </Link>
          ) : (
            <span className="muted small">하루 마무리를 하지 않은 날이에요.</span>
          ))}
      </div>
    </article>
  )
}

/** 이 달 요약(Daylio 통계 참고): 기록한 날, 공부 합계, 평균 컨디션, 연속 기록 */
function MonthSummary({ month, days }: { month: string; days: DailyLog[] }) {
  const saved = days.filter((d) => d.saved)
  const study = days.reduce((sum, d) => sum + d.summary.focusSeconds + d.summary.manualMinutes * 60, 0)
  const conditions = days.map((d) => d.condition).filter((c): c is number => c !== null)
  const average = conditions.length ? conditions.reduce((a, b) => a + b, 0) / conditions.length : null
  // 연속 기록: 가장 최근 날부터 하루씩 거꾸로 마무리한 날이 이어진 수
  const savedDates = new Set(saved.map((d) => d.date))
  let streak = 0
  for (let d = saved[0]?.date; d && savedDates.has(d); d = shiftDate(d, -1)) streak++
  const { to } = monthRange(month)
  const total = Math.min(Number(to.slice(8)), month === todaySeoul().slice(0, 7) ? Number(todaySeoul().slice(8)) : 31)

  return (
    <div className="stat-cards log-summary">
      <div className="card stat-card">
        <span className="muted small">하루 마무리한 날</span>
        <strong className="stat-value">
          {saved.length}/{total}일
        </strong>
      </div>
      <div className="card stat-card">
        <span className="muted small">공부 합계</span>
        <strong className="stat-value">{formatDuration(study)}</strong>
      </div>
      <div className="card stat-card">
        <span className="muted small">평균 컨디션</span>
        <strong className="stat-value">
          {average === null ? '-' : `${CONDITION_LABELS[Math.round(average)]} ${average.toFixed(1)}`}
        </strong>
      </div>
      <div className="card stat-card">
        <span className="muted small">연속 마무리</span>
        <strong className="stat-value">{streak}일</strong>
      </div>
    </div>
  )
}

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']

/** 달력 보기(Day One 달력, Daylio Year in Pixels 참고): 공부량을 색 진하기로, 컨디션을 이모지로 */
function LogCalendar({
  month,
  days,
  focusDate,
  onPick,
}: {
  month: string
  days: DailyLog[]
  focusDate: string | null
  onPick: (date: string) => void
}) {
  const byDate = new Map(days.map((d) => [d.date, d]))
  const max = Math.max(1, ...days.map((d) => d.summary.focusSeconds + d.summary.manualMinutes * 60))
  const { from, to } = monthRange(month)
  const start = mondayOf(from)
  const cells: string[] = []
  for (let d = start; d <= to || cells.length % 7 !== 0; d = shiftDate(d, 1)) cells.push(d)
  const today = todaySeoul()

  return (
    <div className="card log-calendar">
      <div className="log-cal-grid">
        {WEEKDAYS.map((w) => (
          <span key={w} className="muted small log-cal-head">
            {w}
          </span>
        ))}
        {cells.map((date) => {
          const log = byDate.get(date)
          const seconds = log ? log.summary.focusSeconds + log.summary.manualMinutes * 60 : 0
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
                date === focusDate ? 'picked' : '',
              ].join(' ')}
              disabled={!log}
              onClick={() => onPick(date)}
              title={log ? `${dayLabel(date)} · 공부 ${formatDuration(seconds)}` : dayLabel(date)}
              style={
                seconds > 0
                  ? { background: `color-mix(in srgb, var(--up) ${Math.round(15 + (seconds / max) * 55)}%, transparent)` }
                  : undefined
              }
            >
              <span className="log-cal-date">{Number(date.slice(8))}</span>
              <span className="log-cal-mood">{log?.condition ? CONDITION_LABELS[log.condition] : ''}</span>
            </button>
          )
        })}
      </div>
      <p className="muted small">색이 진할수록 공부를 많이 한 날이에요. 기록이 있는 날을 누르면 그날 카드로 가요.</p>
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
