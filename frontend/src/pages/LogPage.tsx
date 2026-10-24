import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { formatDuration } from '../api/focus'
import { getDailyLogs, type DailyLog } from '../api/records'
import { getWeeklyJournals, type WeeklyJournalBrief } from '../api/reviews'
import bookIllust from '../assets/illust/deco-book.svg'
import pencilIllust from '../assets/illust/deco-pencil.svg'
import mascotStudent from '../assets/illust/mascot-student.svg'
import chevronLeft from '../assets/icons/chevron-left.svg'
import chevronRight from '../assets/icons/chevron-right.svg'
import ConditionFace from '../components/ConditionFace'
import IconButton from '../components/IconButton'
import NoteInbox from '../components/NoteInbox'
import ReviewWriter from '../components/ReviewWriter'
import DayWrapUp from '../components/today/DayWrapUp'
import { addMonths, currentMonthSeoul, dayLabel, mondayOf, monthLabel, shiftDate, todaySeoul, weekLabel } from '../utils/date'
import { monthRange } from '../utils/health'

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']

type Picked = { kind: 'day'; date: string } | { kind: 'week'; monday: string } | null

/** 그날 무언가 남겼는지: 하루 마무리를 썼거나 실제 기록이 있다 */
const hasRecord = (log: DailyLog | undefined) => !!log && (log.saved || log.summary.studySeconds > 0)

/**
 * 돌아보기(docs/design.md 11-6 2-9): 글로 돌아보는 곳. 탭 없이 한 화면.
 * 맨 위 이번 주 카드(일지 + 지난 주 피드백), 달력(컨디션, 실제 시간, 마무리 표시, 한 주 칸), 고른 날(주) 패널.
 */
export default function LogPage() {
  const [params, setParams] = useSearchParams()
  const month = params.get('month') ?? currentMonthSeoul()
  const [days, setDays] = useState<DailyLog[] | null>(null)
  const [weeks, setWeeks] = useState<WeeklyJournalBrief[]>([])
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState<Picked>(null)
  /** 일지나 하루 마무리를 저장하면 다시 불러온다 */
  const [version, setVersion] = useState(0)
  /** 하루 마무리 창을 연 날짜 */
  const [wrapDate, setWrapDate] = useState<string | null>(null)

  const { from, to } = monthRange(month)
  const firstMonday = mondayOf(from)
  const cells: string[] = []
  for (let d = firstMonday; d <= to || cells.length % 7 !== 0; d = shiftDate(d, 1)) cells.push(d)
  const mondays = cells.filter((_, i) => i % 7 === 0)

  useEffect(() => {
    setError(null)
    const fail = (e: unknown) => setError(errorMessage(e))
    getDailyLogs(from, to).then(setDays).catch(fail)
    getWeeklyJournals(firstMonday, mondays[mondays.length - 1]).then(setWeeks).catch(fail)
    // mondays는 from, to에서 나온 값이라 month만 보면 된다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, version])

  const move = (delta: number) => {
    setPicked(null)
    setParams({ month: addMonths(month, delta) })
  }

  const today = todaySeoul()
  const byDate = new Map((days ?? []).map((d) => [d.date, d]))
  const journalOf = new Map(weeks.map((w) => [w.weekStart, w]))
  const empty = days !== null && !days.some(hasRecord) && weeks.length === 0
  const isCurrentMonth = month === currentMonthSeoul()

  return (
    <section className="log-page">
      <div className="cal-header">
        <span className="cal-nav">
          <IconButton icon={chevronLeft} label="이전 달" onClick={() => move(-1)} />
          <IconButton icon={chevronRight} label="다음 달" onClick={() => move(1)} />
          <h1 className="cal-title">돌아보기 {monthLabel(month)}</h1>
        </span>
      </div>
      {error && <p className="error-banner">{error}</p>}

      <ReviewWriter onSaved={() => setVersion((v) => v + 1)} />

      <div className="card log-calendar">
        <div className="log-cal-grid">
          {[...WEEKDAYS, '한 주'].map((w) => (
            <span key={w} className="muted small log-cal-head">
              {w}
            </span>
          ))}
          {mondays.map((monday) => (
            <WeekRow
              key={monday}
              dates={cells.slice(cells.indexOf(monday), cells.indexOf(monday) + 7)}
              month={month}
              today={today}
              byDate={byDate}
              journal={journalOf.get(monday)}
              monday={monday}
              picked={picked}
              onPick={(p) => setPicked(samePick(picked, p) ? null : p)}
            />
          ))}
        </div>
        <div className="log-legend">
          <span>
            <ConditionFace value={5} size={14} />
            컨디션
          </span>
          <span>
            <img src={pencilIllust} alt="" width={14} height={14} />
            하루 마무리 씀
          </span>
          <span>
            <img src={bookIllust} alt="" width={14} height={14} />
            일지 씀
          </span>
          <span>숫자: 실제로 한 시간</span>
        </div>
      </div>

      {picked?.kind === 'day' && (
        <DayPanel date={picked.date} log={byDate.get(picked.date)} onWrite={() => setWrapDate(picked.date)} onClose={() => setPicked(null)} />
      )}
      {picked?.kind === 'week' && <WeekPanel monday={picked.monday} journal={journalOf.get(picked.monday)} onClose={() => setPicked(null)} />}
      {!picked && empty && (
        <div className="card log-empty">
          <img src={mascotStudent} alt="" width={110} height={110} />
          <strong>{isCurrentMonth ? '아직 돌아본 날이 없어요' : `${monthLabel(month)}에는 남긴 기록이 없어요`}</strong>
          {isCurrentMonth && (
            <>
              <p className="muted small">하루를 마칠 때 컨디션과 한 줄 메모를 남겨 보세요</p>
              <button onClick={() => setWrapDate(today)}>오늘 마무리하기</button>
            </>
          )}
        </div>
      )}

      <NoteInbox />

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

const samePick = (a: Picked, b: Picked) =>
  !!a && !!b && a.kind === b.kind && (a.kind === 'day' ? a.date === (b as { date: string }).date : a.monday === (b as { monday: string }).monday)

function WeekRow({
  dates,
  month,
  today,
  byDate,
  journal,
  monday,
  picked,
  onPick,
}: {
  dates: string[]
  month: string
  today: string
  byDate: Map<string, DailyLog>
  journal: WeeklyJournalBrief | undefined
  monday: string
  picked: Picked
  onPick: (p: Picked) => void
}) {
  return (
    <>
      {dates.map((date) => {
        const log = byDate.get(date)
        const seconds = log?.summary.studySeconds ?? 0
        const isPicked = picked?.kind === 'day' && picked.date === date
        return (
          <button
            key={date}
            type="button"
            className={['log-cal-cell', date.startsWith(month) ? '' : 'outside', date === today ? 'today' : '', isPicked ? 'picked' : ''].join(' ')}
            onClick={() => onPick({ kind: 'day', date })}
            aria-label={`${dayLabel(date)}${seconds > 0 ? `, 실제 ${formatDuration(seconds)}` : ''}${log?.saved ? ', 하루 마무리 씀' : ''}`}
          >
            <span className="log-cal-date">{Number(date.slice(8))}</span>
            {log?.condition && <ConditionFace value={log.condition} size={18} className="log-cal-face" />}
            {seconds > 0 && <span className="log-cal-study">{formatDuration(seconds)}</span>}
            {log?.saved && <img className="log-cal-pen" src={pencilIllust} alt="" width={14} height={14} />}
          </button>
        )
      })}
      <button
        type="button"
        className={['log-cal-week', journal ? 'written' : '', picked?.kind === 'week' && picked.monday === monday ? 'picked' : ''].join(' ')}
        onClick={() => onPick({ kind: 'week', monday })}
        aria-label={`${weekLabel(monday)} 일지${journal ? ' 씀' : ''}`}
      >
        {journal && <img src={bookIllust} alt="" width={22} height={22} />}
        <span>{journal ? '일지 씀' : '일지'}</span>
      </button>
    </>
  )
}

/** 고른 날: 컨디션, 실제, 할 일, 메모, 쓰기(고치기) */
function DayPanel({ date, log, onWrite, onClose }: { date: string; log: DailyLog | undefined; onWrite: () => void; onClose: () => void }) {
  const future = date > todaySeoul()
  return (
    <div className="card log-panel">
      {log?.condition ? <ConditionFace value={log.condition} size={44} /> : <span className="log-panel-blank" />}
      <div className="log-panel-main">
        <div className="log-panel-head">
          <strong>{dayLabel(date)}</strong>
          <button className="icon" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        {hasRecord(log) ? (
          <>
            <p className="log-panel-line">
              <span className="muted">실제</span> {formatDuration(log!.summary.studySeconds)}
              <span className="muted">할 일</span> {log!.doneGoals.length}/{log!.summary.goalsTotal} 완료
            </p>
            {log!.memo && (
              <div className="log-panel-memo">
                <span className="muted small">메모</span>
                <p>{log!.memo}</p>
              </div>
            )}
          </>
        ) : (
          <p className="muted small">{future ? '아직 오지 않은 날이에요.' : '이날 남긴 기록이 없어요.'}</p>
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
      </div>
    </div>
  )
}

/** 고른 주: 그 주 일지 */
function WeekPanel({ monday, journal, onClose }: { monday: string; journal: WeeklyJournalBrief | undefined; onClose: () => void }) {
  const items: [string, string | null][] = journal
    ? [
        ['잘한 점', journal.good],
        ['아쉬운 점', journal.bad],
        ['다음 주에 바꿀 한 가지', journal.nextAction],
      ]
    : []
  return (
    <div className="card log-panel">
      <img src={bookIllust} alt="" width={44} height={44} />
      <div className="log-panel-main">
        <div className="log-panel-head">
          <strong>{weekLabel(monday)} 일지</strong>
          <button className="icon" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        {journal ? (
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
        ) : (
          <p className="muted small">이 주에는 일지를 쓰지 않았어요.</p>
        )}
      </div>
    </div>
  )
}
