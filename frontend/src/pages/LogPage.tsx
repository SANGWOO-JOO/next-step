import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { formatDuration } from '../api/focus'
import { CONDITION_LABELS, getDailyLogs, type DailyLog } from '../api/records'
import NoteInbox from '../components/NoteInbox'
import ReviewWriter from '../components/ReviewWriter'
import DayWrapUp from '../components/today/DayWrapUp'
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
  const today = todaySeoul()
  const picked =
    pickedDate && pickedDate.startsWith(month)
      ? pickedDate
      : today.startsWith(month)
        ? today
        : (days?.[0]?.date ?? `${month}-01`)

  return (
    <section>
      {/* 다른 화면과 같은 머리: 왼쪽 ‹ › 기간, 오른쪽 [하루|주간|월간](1-4f ㉒) */}
      <div className="cal-header">
        <span className="cal-nav">
          <button className="icon" onClick={() => move(-1)} aria-label="이전" title="이전">
            ‹
          </button>
          <button className="icon" onClick={() => move(1)} aria-label="다음" title="다음">
            ›
          </button>
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
        <div className="log-day-layout">
          <LogCalendar month={month} days={days} picked={picked} onPick={setPickedDate} />
          <DayDetail date={picked} log={days.find((d) => d.date === picked)} onWrite={() => setWrapDate(picked)} />
        </div>
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
function DayDetail({ date, log, onWrite }: { date: string; log: DailyLog | undefined; onWrite: () => void }) {
  const future = date > todaySeoul()
  const plan = log?.summary.plan
  return (
    <article className="card log-detail">
      <div className="log-detail-head">
        <h2 className="log-detail-date">{dayLabel(date)}</h2>
        {log?.condition && (
          <span className="log-detail-mood" title={`컨디션 ${log.condition}`}>
            {CONDITION_LABELS[log.condition]}
          </span>
        )}
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

/** 기록 달력(Day One 달력, Daylio Year in Pixels 참고): 공부량을 색 진하기로, 컨디션을 이모지로. 누르면 그날을 고른다 */
function LogCalendar({
  month,
  days,
  picked,
  onPick,
}: {
  month: string
  days: DailyLog[]
  picked: string
  onPick: (date: string) => void
}) {
  const byDate = new Map(days.map((d) => [d.date, d]))
  const max = Math.max(1, ...days.map((d) => d.summary.studySeconds))
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
          const seconds = log ? log.summary.studySeconds : 0
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
                  background: l.ratio === 0 ? 'transparent' : `color-mix(in srgb, var(--up) ${Math.round(15 + l.ratio * 55)}%, transparent)`,
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
