import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { errorMessage } from '../api/client'
import { formatDuration } from '../api/focus'
import { getHeatmap, getTimeseries, type Heatmap, type StatsSummary, type StatsUnit, type Timeseries } from '../api/stats'

const UNCLASSIFIED = 'none'
const UNIT_LABELS: Record<StatsUnit, string> = { day: '일별', week: '주별', month: '월별' }

const tickStyle = { fill: 'var(--muted)', fontSize: 12 }
const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }

function bucketLabel(start: string, unit: StatsUnit) {
  const [, m, d] = start.split('-').map(Number)
  if (unit === 'month') return `${m}월`
  return unit === 'week' ? `${m}/${d}~` : `${m}/${d}`
}

/** 기간 추이: 분류별 누적 막대(분 단위) */
export function TrendChart({ from, to, unit }: { from: string; to: string; unit: StatsUnit }) {
  const [series, setSeries] = useState<Timeseries | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getTimeseries(from, to, unit)
      .then((s) => {
        setSeries(s)
        setError(null)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [from, to, unit])

  if (error) return <p className="error">{error}</p>
  if (!series) return null

  const hasUnclassified = series.buckets.some((b) => b.byCategory.some((v) => v.categoryId === null))
  const keys = [
    ...series.categories.map((c) => ({ key: String(c.id), name: c.name, color: c.color })),
    ...(hasUnclassified ? [{ key: UNCLASSIFIED, name: '미분류', color: '#9ca3af' }] : []),
  ]
  const data = series.buckets.map((b) => ({
    label: bucketLabel(b.start, unit),
    ...Object.fromEntries(b.byCategory.map((v) => [v.categoryId ?? UNCLASSIFIED, Math.round(v.seconds / 60)])),
  }))

  return (
    <div className="chart-box">
      <h3 className="timeline-title">기간 추이 ({UNIT_LABELS[unit]}, 분)</h3>
      {keys.length === 0 ? (
        <p className="muted small">이 기간에 기록된 공부가 없어요.</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={tickStyle} interval="preserveStartEnd" />
            <YAxis tick={tickStyle} allowDecimals={false} />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: 'color-mix(in srgb, var(--accent) 8%, transparent)' }}
              formatter={(v: number, name: string) => [formatDuration(v * 60), name]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {keys.map((k) => (
              <Bar key={k.key} dataKey={k.key} name={k.name} stackId="study" fill={k.color} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']
const HOURS = Array.from({ length: 24 }, (_, h) => h)

/** 요일 × 시간대 집중 히트맵. 수동 기록은 시간대가 없어 빠진다. */
export function FocusHeatmap({ from, to }: { from: string; to: string }) {
  const [heatmap, setHeatmap] = useState<Heatmap | null>(null)

  useEffect(() => {
    getHeatmap(from, to)
      .then(setHeatmap)
      .catch(() => setHeatmap(null))
  }, [from, to])

  if (!heatmap) return null
  const value = new Map(heatmap.cells.map((c) => [`${c.dayOfWeek}-${c.hour}`, c.seconds]))
  const best = heatmap.cells.reduce<(typeof heatmap.cells)[number] | null>(
    (top, c) => (!top || c.seconds > top.seconds ? c : top),
    null,
  )

  return (
    <div className="chart-box">
      <h3 className="timeline-title">집중 히트맵 (요일 × 시간)</h3>
      {best ? (
        <p className="muted small">
          가장 많이 집중한 칸: {WEEKDAYS[best.dayOfWeek - 1]}요일 {best.hour}시 ({formatDuration(best.seconds)})
        </p>
      ) : (
        <p className="muted small">이 기간에 집중 세션이 없어요.</p>
      )}
      <div className="heatmap-scroll">
        <div className="heatmap" role="table" aria-label="요일별 시간대 집중 시간">
          <span />
          {HOURS.map((h) => (
            <span key={h} className="heatmap-hour">
              {h % 3 === 0 ? h : ''}
            </span>
          ))}
          {WEEKDAYS.map((w, i) => (
            <div key={w} className="heatmap-row" role="row">
              <span className="heatmap-day">{w}</span>
              {HOURS.map((h) => {
                const s = value.get(`${i + 1}-${h}`) ?? 0
                const level = heatmap.maxSeconds ? s / heatmap.maxSeconds : 0
                return (
                  <span
                    key={h}
                    className="heatmap-cell"
                    role="cell"
                    title={`${w} ${h}시 · ${s ? formatDuration(s) : '없음'}`}
                    style={{
                      background:
                        s > 0
                          ? `color-mix(in srgb, var(--accent) ${Math.round(20 + level * 80)}%, transparent)`
                          : undefined,
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** 집중 vs 딴짓 도넛 */
export function FocusVsDistraction({ summary }: { summary: StatsSummary }) {
  const data = [
    { name: '집중', value: summary.focusSeconds, color: 'var(--up)' },
    { name: '딴짓', value: summary.distractionSeconds, color: 'var(--down)' },
  ]
  const total = summary.focusSeconds + summary.distractionSeconds

  return (
    <div className="chart-box">
      <h3 className="timeline-title">집중 vs 딴짓</h3>
      {total === 0 ? (
        <p className="muted small">이 기간에 집중 세션이 없어요.</p>
      ) : (
        <div className="donut">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={75} stroke="none">
                {data.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [formatDuration(v), name]} />
            </PieChart>
          </ResponsiveContainer>
          <span className="donut-center">
            <strong>{Math.round((1 - summary.distractionRatio) * 100)}%</strong>
            <span className="muted small">집중</span>
          </span>
          <p className="small donut-legend">
            <span className="diff up">집중 {formatDuration(summary.focusSeconds)}</span> ·{' '}
            <span className="diff down">딴짓 {formatDuration(summary.distractionSeconds)}</span>
          </p>
        </div>
      )}
    </div>
  )
}
