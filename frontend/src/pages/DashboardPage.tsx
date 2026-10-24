import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { getReport, type Report, type ReportBucket, type ReportPeriod } from '../api/report'
import { parseFeedback } from '../api/reviews'
import chevronLeft from '../assets/icons/chevron-left.svg'
import chevronRight from '../assets/icons/chevron-right.svg'
import calendarIllust from '../assets/illust/deco-calendar.svg'
import mascot from '../assets/illust/mascot-wave.svg'
import trophy from '../assets/illust/deco-trophy.svg'
import GoalIcon from '../components/GoalIcon'
import IconButton from '../components/IconButton'
import { addMonths, mondayOf, monthLabel, shiftDate, todaySeoul, weekLabel } from '../utils/date'

const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일']

/** 분 → "3시간 30분", "45분", "0분" */
const hours = (minutes: number) => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}분`
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`
}

/**
 * 내 공부 리포트(docs/design.md 11-6 2-8): "이번 주(달)에 얼마나, 어디에 썼고, 계획대로 했나?" 하나에 답한다.
 * 큰 숫자 카드, 요일별(달은 주별) 계획과 실제, 목표별, 지난 주 피드백.
 */
export default function DashboardPage() {
  const today = todaySeoul()
  const [period, setPeriod] = useState<ReportPeriod>('WEEK')
  const [start, setStart] = useState(mondayOf(today))
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getReport(period, start)
      .then((r) => {
        setReport(r)
        setError(null)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [period, start])

  const switchTo = (p: ReportPeriod) => {
    setPeriod(p)
    setStart(p === 'WEEK' ? mondayOf(today) : `${today.slice(0, 7)}-01`)
  }
  const move = (delta: number) =>
    setStart(period === 'WEEK' ? shiftDate(start, delta * 7) : `${addMonths(start.slice(0, 7), delta)}-01`)
  const isCurrent = period === 'WEEK' ? start === mondayOf(today) : start.slice(0, 7) === today.slice(0, 7)
  const label = period === 'WEEK' ? weekLabel(start) : monthLabel(start.slice(0, 7))
  const unit = period === 'WEEK' ? '주' : '달'

  return (
    <section className="report-page">
      <div className="cal-header">
        <span className="cal-nav">
          <IconButton icon={chevronLeft} label={`이전 ${unit}`} onClick={() => move(-1)} />
          <IconButton icon={chevronRight} label={`다음 ${unit}`} onClick={() => move(1)} />
          <h1 className="cal-title">내 공부 리포트</h1>
        </span>
        <span className="segmented" role="group" aria-label="기간">
          <button className={period === 'WEEK' ? 'active' : ''} onClick={() => switchTo('WEEK')}>
            이번 주
          </button>
          <button className={period === 'MONTH' ? 'active' : ''} onClick={() => switchTo('MONTH')}>
            이번 달
          </button>
        </span>
      </div>
      {error && <p className="error-banner">{error}</p>}
      {report && (report.actualMinutes + report.plannedMinutes === 0 ? (
        <div className="card report-empty">
          <img src={calendarIllust} alt="" width={120} height={120} />
          <strong>{isCurrent ? `이번 ${unit} 기록이 아직 없어요` : `${label}에는 기록이 없어요`}</strong>
          <p className="muted small">일정에서 한 일을 기록하면 여기에 쌓여요</p>
          {isCurrent && (
            <Link className="button-link" to="/">
              일정으로 가기
            </Link>
          )}
        </div>
      ) : (
        <ReportBody report={report} label={label} unit={unit} today={today} />
      ))}
    </section>
  )
}

function ReportBody({ report, label, unit, today }: { report: Report; label: string; unit: string; today: string }) {
  const ratio = report.plannedMinutes > 0 ? Math.round((report.actualMinutes / report.plannedMinutes) * 100) : null
  const diff = report.actualMinutes - report.previousActualMinutes
  const feedback = parseFeedback(report.lastWeekFeedback)
  const weekly = report.period === 'WEEK'

  return (
    <>
      <div className="card report-hero">
        <img src={mascot} alt="" width={92} height={92} />
        <div className="report-hero-text">
          <span className="report-sub">{label} 실제로 한 시간</span>
          <strong className="report-big">{hours(report.actualMinutes)}</strong>
          <span className="report-sub">{ratio === null ? '계획한 시간이 없어요' : `계획 ${hours(report.plannedMinutes)} 중 ${ratio}%`}</span>
          {ratio !== null && (
            <span className="report-progress">
              <i style={{ width: `${Math.min(100, ratio)}%` }} />
            </span>
          )}
          <span className="report-chips">
            <span className="report-chip">
              {diff === 0 ? `지난 ${unit}와 같아요` : (
                <>
                  <b className={diff > 0 ? 'up' : 'down'}>
                    {diff > 0 ? '▲' : '▼'} {hours(Math.abs(diff))}
                  </b>{' '}
                  지난 {unit}보다
                </>
              )}
            </span>
            <span className="report-chip">공부한 날 {report.studyDays}일</span>
            <span className="report-chip">연속 {report.streakDays}일</span>
          </span>
        </div>
      </div>

      <div className="card">
        <h3 className="report-title">{weekly ? '요일별' : '주별'}</h3>
        <Bars buckets={report.buckets} weekly={weekly} today={today} />
        <div className="report-legend">
          <span>
            <i className="plan" />
            계획
          </span>
          <span>
            <i className="act" />
            실제
          </span>
        </div>
      </div>

      {report.goals.length > 0 && (
        <div className="card">
          <h3 className="report-title">목표별</h3>
          {report.goals.map((g) => {
            const max = Math.max(1, ...report.goals.map((x) => Math.max(x.plannedMinutes, x.actualMinutes)))
            return (
              <div key={g.id} className="report-goal">
                <GoalIcon icon={g.icon} color={g.color} size={28} />
                <div className="report-goal-main">
                  <span className="report-goal-name">{g.title}</span>
                  <span className="report-goal-track">
                    <i className="plan" style={{ width: `${(g.plannedMinutes / max) * 100}%` }} />
                    <i className="act" style={{ width: `${(g.actualMinutes / max) * 100}%`, background: g.color }} />
                  </span>
                  {g.topDetail && (
                    <span className="muted small">
                      많이 한 것: {g.topDetail} {hours(g.topDetailMinutes)}
                    </span>
                  )}
                </div>
                <span className="report-goal-time">
                  <b>{hours(g.actualMinutes)}</b> / {hours(g.plannedMinutes)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {feedback && (
        <Link className="card report-feedback" to="/log?kind=week">
          <img src={trophy} alt="" width={40} height={40} />
          <span>
            <span className="report-sub">지난 주 피드백</span>
            <strong>{feedback.summary}</strong>
            <span className="report-more">기록에서 전체 보기 ›</span>
          </span>
        </Link>
      )}
    </>
  )
}

/** 계획(점선)과 실제(채움)를 겹친 막대 */
function Bars({ buckets, weekly, today }: { buckets: ReportBucket[]; weekly: boolean; today: string }) {
  const max = Math.max(60, ...buckets.map((b) => Math.max(b.plannedMinutes, b.actualMinutes)))
  const h = (m: number) => `${(m / max) * 100}%`
  return (
    <div className="report-bars" style={{ gridTemplateColumns: `repeat(${buckets.length}, 1fr)` }}>
      {buckets.map((b, i) => {
        const current = weekly ? b.start === today : b.start === mondayOf(today)
        return (
          <div key={b.start} className={current ? 'report-bar current' : 'report-bar'} title={`계획 ${hours(b.plannedMinutes)}, 실제 ${hours(b.actualMinutes)}`}>
            <span className="report-bar-area">
              {b.plannedMinutes > 0 && <i className="plan" style={{ height: h(b.plannedMinutes) }} />}
              {b.actualMinutes > 0 && <i className="act" style={{ height: h(b.actualMinutes) }} />}
            </span>
            <span className="report-bar-label">{weekly ? DAY_NAMES[i] : `${i + 1}주`}</span>
          </div>
        )
      })}
    </div>
  )
}
