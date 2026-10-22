import { useState } from 'react'
import type { DailyGoal } from '../api/dailyGoals'
import { createTimeBlock, deleteTimeBlock, updateTimeBlock, type TimeBlock } from '../api/timeBlocks'
import { formatMinutes, minutesOfDay, nowMinutesSeoul, todaySeoul } from '../utils/date'
import TimeBlockForm from './TimeBlockForm'

const HOUR_PX = 44
const SLOT = 30
const DEFAULT_START_HOUR = 6

type Props = {
  date: string
  blocks: TimeBlock[]
  goals: DailyGoal[]
  run: (action: () => Promise<unknown>) => Promise<boolean>
}

type Editing = { kind: 'new'; start: number } | { kind: 'edit'; block: TimeBlock } | null

/** 하루 타임라인. 빈 칸을 누르면 30분 블록을 만들고, 블록을 누르면 고치거나 지운다. */
export default function TimeBlockTimeline({ date, blocks, goals, run }: Props) {
  const [editing, setEditing] = useState<Editing>(null)
  const isToday = date === todaySeoul()
  const now = isToday ? nowMinutesSeoul() : null

  // 06시부터 보여주되, 더 이른 블록이 있으면 그 시각부터
  const earliest = Math.min(DEFAULT_START_HOUR * 60, ...blocks.map((b) => minutesOfDay(b.startAt, date)))
  const startHour = Math.floor(earliest / 60)
  const hours = Array.from({ length: 24 - startHour }, (_, i) => startHour + i)
  const top = (minutes: number) => ((minutes - startHour * 60) / 60) * HOUR_PX
  const blockGoals = goals.filter((g) => g.status === 'TODO')

  const openNew = (start: number) => {
    if (blockGoals.length > 0) setEditing({ kind: 'new', start })
  }

  return (
    <div className="timeline-wrap">
      {editing && (
        <TimeBlockForm
          key={editing.kind === 'new' ? `new-${editing.start}` : `edit-${editing.block.id}`}
          date={date}
          goals={editing.kind === 'edit' ? goals : blockGoals}
          dailyGoalId={editing.kind === 'edit' ? editing.block.dailyGoalId : blockGoals[0].id}
          startMinutes={editing.kind === 'new' ? editing.start : minutesOfDay(editing.block.startAt, date)}
          endMinutes={
            editing.kind === 'new' ? Math.min(editing.start + 60, 1440) : minutesOfDay(editing.block.endAt, date)
          }
          submitLabel={editing.kind === 'new' ? '추가' : '저장'}
          onSubmit={(input) =>
            run(() =>
              editing.kind === 'new' ? createTimeBlock(input) : updateTimeBlock(editing.block.id, input),
            ).then((ok) => ok && setEditing(null))
          }
          onCancel={() => setEditing(null)}
          onDelete={
            editing.kind === 'edit'
              ? () => run(() => deleteTimeBlock(editing.block.id)).then((ok) => ok && setEditing(null))
              : undefined
          }
        />
      )}
      {blockGoals.length === 0 && <p className="muted small">하루 목표를 먼저 추가하면 시간을 잡을 수 있어요.</p>}

      <div className="timeline" style={{ height: hours.length * HOUR_PX }}>
        {hours.map((h) => (
          <div key={h} className="timeline-hour" style={{ top: top(h * 60), height: HOUR_PX }}>
            <span className="timeline-label">{String(h).padStart(2, '0')}</span>
            {[0, SLOT].map((offset) => (
              <button
                key={offset}
                type="button"
                className="timeline-slot"
                style={{ height: (HOUR_PX * SLOT) / 60 }}
                onClick={() => openNew(h * 60 + offset)}
                aria-label={`${formatMinutes(h * 60 + offset)} 블록 추가`}
                disabled={blockGoals.length === 0}
              />
            ))}
          </div>
        ))}

        {blocks.map((b) => {
          const start = minutesOfDay(b.startAt, date)
          const end = minutesOfDay(b.endAt, date)
          const color = b.category?.color ?? 'var(--muted)'
          return (
            <button
              key={b.id}
              type="button"
              className={b.dailyGoalStatus === 'DONE' ? 'timeline-block done' : 'timeline-block'}
              style={{
                top: top(start),
                height: Math.max(top(end) - top(start), 18),
                borderLeftColor: color,
                background: `color-mix(in srgb, ${color} 18%, var(--surface))`,
              }}
              onClick={() => setEditing({ kind: 'edit', block: b })}
              title="눌러서 고치기"
            >
              <span className="timeline-block-time">
                {formatMinutes(start)}~{formatMinutes(end)}
              </span>{' '}
              {b.dailyGoalContent}
            </button>
          )
        })}

        {now !== null && now >= startHour * 60 && (
          <div className="timeline-now" style={{ top: top(now) }} aria-label="지금" />
        )}
      </div>
    </div>
  )
}
