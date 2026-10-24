import { useEffect, useState } from 'react'
import { errorMessage } from '../api/client'
import { formatDuration } from '../api/focus'
import {
  getStatsByCategory,
  getStatsByTopic,
  getStatsSummary,
  unitFor,
  type CategoryStat,
  type StatsSummary,
  type TopicCategoryStat,
} from '../api/stats'
import { FocusHeatmap, FocusVsDistraction, TrendChart } from '../components/DashboardCharts'
import { addMonths, mondayOf, shiftDate, todaySeoul } from '../utils/date'

type Period = 'today' | 'week' | 'month' | 'custom'

const PERIOD_LABELS: Record<Period, string> = { today: '오늘', week: '이번 주', month: '이번 달', custom: '직접' }

/** 기간과 바로 앞 같은 길이 기간 */
function periodRange(period: Exclude<Period, 'custom'>, today: string) {
  if (period === 'today') return { from: today, to: today, prevFrom: shiftDate(today, -1), prevTo: shiftDate(today, -1) }
  if (period === 'week') {
    const monday = mondayOf(today)
    return { from: monday, to: today, prevFrom: shiftDate(monday, -7), prevTo: shiftDate(today, -7) }
  }
  const first = `${today.slice(0, 7)}-01`
  const prevFirst = `${addMonths(today.slice(0, 7), -1)}-01`
  // 지난달 같은 날까지(지난달이 짧으면 말일까지)
  const prevEnd = shiftDate(first, -1)
  const sameDay = `${prevFirst.slice(0, 8)}${today.slice(8)}`
  return { from: first, to: today, prevFrom: prevFirst, prevTo: sameDay < prevEnd ? sameDay : prevEnd }
}

export default function DashboardPage() {
  const today = todaySeoul()
  const [period, setPeriod] = useState<Period>('week')
  const [custom, setCustom] = useState({ from: shiftDate(today, -13), to: today })
  const [cards, setCards] = useState<{ label: string; now: StatsSummary; prev: StatsSummary }[]>([])
  const [selected, setSelected] = useState<StatsSummary | null>(null)
  const [categories, setCategories] = useState<CategoryStat[]>([])
  const [topics, setTopics] = useState<TopicCategoryStat[]>([])
  const [error, setError] = useState<string | null>(null)

  // 상단 카드: 오늘 / 이번 주 / 이번 달, 각각 지난 같은 기간과 비교
  useEffect(() => {
    const periods = (['today', 'week', 'month'] as const).map((p) => ({ p, r: periodRange(p, today) }))
    Promise.all(
      periods.map(({ p, r }) =>
        Promise.all([getStatsSummary(r.from, r.to), getStatsSummary(r.prevFrom, r.prevTo)]).then(([now, prev]) => ({
          label: PERIOD_LABELS[p],
          now,
          prev,
        })),
      ),
    )
      .then(setCards)
      .catch((e) => setError(errorMessage(e)))
  }, [today])

  const range = period === 'custom' ? custom : periodRange(period, today)

  useEffect(() => {
    Promise.all([getStatsSummary(range.from, range.to), getStatsByCategory(range.from, range.to), getStatsByTopic(range.from, range.to)])
      .then(([s, c, t]) => {
        setSelected(s)
        setCategories(c)
        setTopics(t)
        setError(null)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [range.from, range.to])

  const month = cards.find((c) => c.label === '이번 달')?.now

  return (
    <section>
      <h1>시간 대시보드</h1>
      <p className="muted">순 공부시간 = 시간표 실제 기록(목표 공부) + 타이머 없이 한 공부. 실제 기록 이전 날은 지난 집중 세션</p>
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}

      <div className="stat-cards">
        {cards.map((c) => (
          <StatCard key={c.label} label={c.label} now={c.now} prev={c.prev} />
        ))}
        {month && (
          <>
            <div className="card stat-card">
              <span className="muted small">일평균 (이번 달)</span>
              <strong className="stat-value">{formatDuration(month.dailyAverageSeconds)}</strong>
              <span className="muted small">
                {month.days}일 중 {month.studyDays}일 공부
              </span>
            </div>
            <div className="card stat-card">
              <span className="muted small">연속 공부일</span>
              <strong className="stat-value">{month.streakDays}일</strong>
              <span className="muted small">오늘 안 했으면 어제부터 셈</span>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="goal-header">
          <h2 className="goal-title">기간별 목표</h2>
          <span className="segmented">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <button key={p} className={period === p ? 'active' : ''} onClick={() => setPeriod(p)}>
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </span>
        </div>
        {period === 'custom' && (
          <p className="inline-form">
            <input
              type="date"
              value={custom.from}
              max={custom.to}
              onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })}
              aria-label="시작일"
            />
            ~
            <input
              type="date"
              value={custom.to}
              min={custom.from}
              onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })}
              aria-label="종료일"
            />
          </p>
        )}
        {selected && <PeriodSummary summary={selected} />}
        <CategoryBars stats={categories} />
      </div>

      {topics.some((c) => c.topics.some((t) => t.title !== null)) && (
        <div className="card">
          <TopicStats stats={topics} />
        </div>
      )}

      <div className="card">
        <TrendChart from={range.from} to={range.to} unit={period === 'month' ? 'week' : unitFor(range.from, range.to)} />
      </div>
      <div className="dashboard-grid">
        <div className="card">
          <FocusHeatmap from={range.from} to={range.to} />
        </div>
        <div className="card">{selected && <FocusVsDistraction summary={selected} />}</div>
      </div>
    </section>
  )
}

function Diff({ now, prev }: { now: number; prev: number }) {
  const diff = now - prev
  if (diff === 0) return <span className="muted small">지난 기간과 같음</span>
  return (
    <span className={diff > 0 ? 'small diff up' : 'small diff down'}>
      {diff > 0 ? '▲' : '▼'} {formatDuration(Math.abs(diff))} (지난 기간 대비)
    </span>
  )
}

function StatCard({ label, now, prev }: { label: string; now: StatsSummary; prev: StatsSummary }) {
  const percent = now.targetSeconds ? Math.round((now.totalSeconds / now.targetSeconds) * 100) : null
  return (
    <div className="card stat-card">
      <span className="muted small">{label}</span>
      <strong className="stat-value">{formatDuration(now.totalSeconds)}</strong>
      <Diff now={now.totalSeconds} prev={prev.totalSeconds} />
      {percent !== null && (
        <span className="muted small">
          목표 {formatDuration(now.targetSeconds!)}의 {percent}%
        </span>
      )}
    </div>
  )
}

function PeriodSummary({ summary: s }: { summary: StatsSummary }) {
  const focusShare = s.focusSeconds + s.distractionSeconds
  return (
    <dl className="result-stats log-stats period-stats">
      <dt>순 공부</dt>
      <dd>{formatDuration(s.totalSeconds)}</dd>
      <dt>시간 기록</dt>
      <dd>{formatDuration(s.focusSeconds)}</dd>
      <dt>수동 기록</dt>
      <dd>{formatDuration(s.manualSeconds)}</dd>
      <dt>딴짓</dt>
      <dd>
        {formatDuration(s.distractionSeconds)}
        {focusShare > 0 && ` (${Math.round(s.distractionRatio * 100)}%)`}
      </dd>
      <dt>일평균</dt>
      <dd>{formatDuration(s.dailyAverageSeconds)}</dd>
    </dl>
  )
}

/** 분류별 비율(가로 누적 막대)과 분류별 시간 막대(목표 비율 표시) */
/**
 * 주제별 공부 시간(1-4f ㊾, Toggl 보고서처럼 분류 → 주제). 블록에 적은 주제를 실제 기록 기준으로 묶는다.
 * 주제를 하나도 안 적은 분류는 빼고, 안 적은 시간은 "주제 없음"으로 맨 아래.
 */
function TopicStats({ stats }: { stats: TopicCategoryStat[] }) {
  const shown = stats.filter((c) => c.topics.some((t) => t.title !== null))
  return (
    <>
      <h3 className="timeline-title">주제별</h3>
      <div className="topic-stats">
        {shown.map((c) => {
          const color = c.category?.color ?? 'var(--muted)'
          const max = Math.max(1, ...c.topics.map((t) => t.seconds))
          return (
            <section key={c.category?.id ?? 'none'} className="topic-stats-group">
              <header>
                {c.category?.icon && <span aria-hidden="true">{c.category.icon}</span>}
                <strong>{c.category?.name ?? '목표 없음'}</strong>
                <span className="muted small">{formatDuration(c.seconds)}</span>
              </header>
              <ul>
                {c.topics.map((t) => (
                  <li key={t.title ?? '(none)'} className={t.title === null ? 'muted' : undefined}>
                    <span className="topic-stats-name">{t.title ?? '주제 없음'}</span>
                    <span className="topic-stats-track">
                      <span
                        className="topic-stats-fill"
                        style={{ width: `${(t.seconds / max) * 100}%`, background: t.title === null ? 'var(--border)' : color }}
                      />
                    </span>
                    <span className="small topic-stats-value">{formatDuration(t.seconds)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </>
  )
}

function CategoryBars({ stats }: { stats: CategoryStat[] }) {
  const total = stats.reduce((sum, s) => sum + s.seconds, 0)
  const max = Math.max(1, ...stats.map((s) => Math.max(s.seconds, s.targetSeconds ?? 0)))
  const color = (s: CategoryStat) => s.category?.color ?? 'var(--muted)'
  const name = (s: CategoryStat) => s.category?.name ?? '목표 없음'

  if (total === 0) return <p className="muted small">이 기간에 기록된 공부가 없어요.</p>

  return (
    <>
      <div className="stack-bar" role="img" aria-label="목표별 비율">
        {stats
          .filter((s) => s.seconds > 0)
          .map((s) => (
            <span
              key={s.category?.id ?? 'none'}
              style={{ width: `${s.ratio * 100}%`, background: color(s) }}
              title={`${name(s)} ${Math.round(s.ratio * 100)}%`}
            />
          ))}
      </div>
      <ul className="category-bars">
        {stats.map((s) => (
          <li key={s.category?.id ?? 'none'}>
            <span className="category-bar-name">
              <span className="badge-dot" style={{ background: color(s) }} />
              {name(s)}
            </span>
            <span className="category-bar-track">
              <span className="category-bar-fill" style={{ width: `${(s.seconds / max) * 100}%`, background: color(s) }} />
              {s.targetSeconds !== null && (
                <span
                  className="category-bar-target"
                  style={{ left: `${(s.targetSeconds / max) * 100}%` }}
                  title={`주간 목표 기준 ${formatDuration(s.targetSeconds)}`}
                />
              )}
            </span>
            <span className="small category-bar-value">
              {formatDuration(s.seconds)} · {Math.round(s.ratio * 100)}%
              {s.targetRatio !== null && <span className="muted"> / 목표 {s.targetRatio}%</span>}
            </span>
          </li>
        ))}
      </ul>
      {stats.some((s) => s.targetSeconds !== null) && (
        <p className="muted small">세로선은 주간 목표 시간을 이 기간 길이에 맞춘 값이에요.</p>
      )}
    </>
  )
}
