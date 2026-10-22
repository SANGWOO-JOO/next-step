import { useEffect, useRef, useState, type DragEvent, type PointerEvent } from 'react'
import type { DailyGoal } from '../api/dailyGoals'
import { formatDuration, type FocusSession } from '../api/focus'
import { createTimeBlock, deleteTimeBlock, toTimeBlockInput, updateTimeBlock, type TimeBlock } from '../api/timeBlocks'
import { dayLabel, formatMinutes, minutesOfDay, nowMinutesSeoul, seoulIso, todaySeoul } from '../utils/date'
import TimeBlockForm from './TimeBlockForm'

const HOUR_PX = 48
/** 드래그는 15분 단위로 맞춘다 */
const SNAP = 15
const DAY = 1440
/** 블록 아래 끝에서 이만큼(px)을 잡으면 길이 바꾸기 */
const RESIZE_ZONE = 8
/** 하루 목표를 끌어다 놓을 때 쓰는 dataTransfer 형식 */
export const GOAL_DRAG_TYPE = 'application/x-daily-goal'

type Run = (action: () => Promise<unknown>) => Promise<boolean>

type Props = {
  /** 하루(일 보기) 또는 월~일 7일(주 보기) */
  dates: string[]
  blocks: TimeBlock[]
  goals: DailyGoal[]
  sessions: FocusSession[]
  run: Run
  onStartFocus?: (goal: DailyGoal) => void
}

/** 드래그 중 상태. create는 빈 칸을 끌어 범위를 고르는 중, move/resize는 블록을 옮기거나 늘이는 중 */
type Drag =
  | { kind: 'create'; date: string; anchor: number; start: number; end: number }
  | { kind: 'move' | 'resize'; block: TimeBlock; date: string; grab: number; start: number; end: number; moved: boolean }

type Popover = { kind: 'new'; date: string; start: number; end: number } | { kind: 'edit'; block: TimeBlock } | null

const snap = (minutes: number) => Math.min(DAY, Math.max(0, Math.round(minutes / SNAP) * SNAP))
const toPx = (minutes: number) => (minutes / 60) * HOUR_PX

/** 이벤트 위치를 그 열의 0시부터의 분으로 */
function minuteAt(e: { clientY: number }, column: HTMLElement) {
  return snap(((e.clientY - column.getBoundingClientRect().top) / HOUR_PX) * 60)
}

/**
 * 맥 캘린더 같은 시간표. 빈 칸을 끌어 블록을 만들고, 블록을 끌어 옮기거나 아래 끝을 끌어 늘인다.
 * 하루 목표를 끌어다 놓으면 1시간 블록이 생기고, 지난 시간에는 실제 집중 세션을 오른쪽에 겹쳐 보여준다.
 */
export default function ScheduleView({ dates, blocks, goals, sessions, run, onStartFocus }: Props) {
  const today = todaySeoul()
  const [drag, setDrag] = useState<Drag | null>(null)
  const [popover, setPopover] = useState<Popover>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [now, setNow] = useState(nowMinutesSeoul)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(nowMinutesSeoul()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  // 처음 열면 지금 1시간 전으로 스크롤한다
  useEffect(() => {
    scroller.current?.scrollTo({ top: toPx(Math.max(0, nowMinutesSeoul() - 60)) })
  }, [])

  const goalsOf = (date: string) => goals.filter((g) => g.date === date)

  // ---- 빈 칸 드래그로 만들기 ----
  const onColumnPointerDown = (e: PointerEvent<HTMLDivElement>, date: string) => {
    if (e.button !== 0 || e.target !== e.currentTarget) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const m = Math.min(minuteAt(e, e.currentTarget), DAY - SNAP)
    setPopover(null)
    setDrag({ kind: 'create', date, anchor: m, start: m, end: m + SNAP })
  }

  // ---- 블록 끌기. 아래 끝 RESIZE_ZONE 픽셀 안을 잡으면 길이를 바꾼다 ----
  const onBlockPointerDown = (e: PointerEvent<HTMLElement>, block: TimeBlock, date: string) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const kind = e.clientY > e.currentTarget.getBoundingClientRect().bottom - RESIZE_ZONE ? 'resize' : 'move'
    const column = e.currentTarget.closest<HTMLElement>('.schedule-column')!
    column.setPointerCapture(e.pointerId)
    const start = minutesOfDay(block.startAt, date)
    const end = minutesOfDay(block.endAt, date)
    setPopover(null)
    setDrag({ kind, block, date, grab: minuteAt(e, column) - start, start, end, moved: false })
  }

  const onColumnPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag) return
    const m = minuteAt(e, e.currentTarget)
    if (drag.kind === 'create') {
      // 위로 끌어도 되게 anchor 기준으로 양쪽을 정한다
      const start = Math.min(drag.anchor, m)
      const end = Math.max(drag.anchor + SNAP, m)
      setDrag({ ...drag, start, end: Math.min(end, DAY) })
    } else if (drag.kind === 'move') {
      const length = minutesOfDay(drag.block.endAt, drag.date) - minutesOfDay(drag.block.startAt, drag.date)
      const start = Math.min(Math.max(0, m - drag.grab), DAY - length)
      if (start !== drag.start) setDrag({ ...drag, start, end: start + length, moved: true })
    } else {
      const end = Math.max(drag.start + SNAP, m)
      if (end !== drag.end) setDrag({ ...drag, end, moved: true })
    }
  }

  const onColumnPointerUp = () => {
    if (!drag) return
    setDrag(null)
    if (drag.kind === 'create') {
      // 그냥 누르기만 했으면 1시간짜리로
      const end = drag.end - drag.start <= SNAP ? Math.min(drag.start + 60, DAY) : drag.end
      setPopover({ kind: 'new', date: drag.date, start: drag.start, end })
      return
    }
    if (!drag.moved) {
      setPopover({ kind: 'edit', block: drag.block })
      return
    }
    run(() =>
      updateTimeBlock(
        drag.block.id,
        toTimeBlockInput(drag.block, seoulIso(drag.date, drag.start), seoulIso(drag.date, drag.end)),
      ),
    )
  }

  // ---- 하루 목표 끌어다 놓기 ----
  const onDrop = (e: DragEvent<HTMLDivElement>, date: string) => {
    const id = Number(e.dataTransfer.getData(GOAL_DRAG_TYPE))
    if (!id) return
    e.preventDefault()
    const goal = goals.find((g) => g.id === id)
    if (!goal || goal.date !== date) {
      setNotice(`그날(${dayLabel(date)})의 하루 목표만 놓을 수 있어요.`)
      return
    }
    const start = Math.min(minuteAt(e, e.currentTarget), DAY - SNAP)
    setNotice(null)
    run(() =>
      createTimeBlock({ dailyGoalId: id, startAt: seoulIso(date, start), endAt: seoulIso(date, Math.min(start + 60, DAY)) }),
    )
  }

  const week = dates.length > 1

  return (
    <div className={week ? 'schedule week' : 'schedule'}>
      {notice && (
        <p className="notice small">
          {notice}{' '}
          <button className="icon" onClick={() => setNotice(null)} aria-label="닫기">
            ×
          </button>
        </p>
      )}
      <div className="schedule-head" style={{ gridTemplateColumns: `3rem repeat(${dates.length}, minmax(0, 1fr))` }}>
        <span />
        {dates.map((d) => (
          <span key={d} className={d === today ? 'schedule-date today' : 'schedule-date'}>
            {week ? dayLabel(d).replace(/^\d+월 /, '') : dayLabel(d)}
          </span>
        ))}
        <span className="schedule-allday-label muted">목표</span>
        {dates.map((d) => (
          <div key={d} className="schedule-allday">
            {goalsOf(d).map((g) => (
              <span
                key={g.id}
                className={g.status === 'DONE' ? 'schedule-goal done' : 'schedule-goal'}
                draggable={g.status === 'TODO'}
                onDragStart={(e) => e.dataTransfer.setData(GOAL_DRAG_TYPE, String(g.id))}
                style={{ borderLeftColor: g.category?.color ?? 'var(--muted)' }}
                title={g.status === 'TODO' ? '시간표로 끌어다 놓으면 1시간 블록이 생겨요' : '완료한 목표'}
              >
                {g.type === 'CORE' ? '★ ' : ''}
                {g.content}
              </span>
            ))}
          </div>
        ))}
      </div>

      <div className="schedule-scroll" ref={scroller}>
        <div
          className="schedule-body"
          style={{ gridTemplateColumns: `3rem repeat(${dates.length}, minmax(0, 1fr))`, height: toPx(DAY) }}
        >
          <div className="schedule-gutter">
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="schedule-hour-label" style={{ top: toPx(h * 60) }}>
                {h === 0 ? '' : `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}시`}
              </span>
            ))}
          </div>
          {dates.map((date) => (
            <div
              key={date}
              className={date === today ? 'schedule-column today' : 'schedule-column'}
              onPointerDown={(e) => onColumnPointerDown(e, date)}
              onPointerMove={onColumnPointerMove}
              onPointerUp={onColumnPointerUp}
              onPointerCancel={() => setDrag(null)}
              onDragOver={(e) => e.dataTransfer.types.includes(GOAL_DRAG_TYPE) && e.preventDefault()}
              onDrop={(e) => onDrop(e, date)}
            >
              {sessions
                .filter((s) => s.date === date)
                .map((s) => {
                  const start = minutesOfDay(s.startedAt, date)
                  const end = s.endedAt ? minutesOfDay(s.endedAt, date) : date === today ? now : start
                  return (
                    <span
                      key={s.id}
                      className={s.running ? 'schedule-session running' : 'schedule-session'}
                      style={{ top: toPx(start), height: Math.max(toPx(end - start), 3) }}
                      title={`실제 집중 ${formatMinutes(start)}~${formatMinutes(Math.min(end, DAY))} · ${formatDuration(s.focusSeconds)}`}
                    />
                  )
                })}

              {blocks
                .filter((b) => b.date === date)
                .map((b) => {
                  const dragging = drag && drag.kind !== 'create' && drag.block.id === b.id ? drag : null
                  const start = dragging?.start ?? minutesOfDay(b.startAt, date)
                  const end = dragging?.end ?? minutesOfDay(b.endAt, date)
                  // 목표 아닌 일정은 회색 점선 테두리로 구분한다
                  const color = b.category?.color ?? 'var(--muted)'
                  const short = end - start <= 30
                  return (
                    <div
                      key={b.id}
                      className={[
                        'schedule-block',
                        b.dailyGoalStatus === 'DONE' ? 'done' : '',
                        b.dailyGoalId === null ? 'free' : '',
                        dragging ? 'dragging' : '',
                        short ? 'short' : '',
                      ].join(' ')}
                      style={{
                        top: toPx(start),
                        height: Math.max(toPx(end - start) - 2, 14),
                        borderLeftColor: color,
                        background: `color-mix(in srgb, ${color} 22%, var(--surface))`,
                      }}
                      onPointerDown={(e) => onBlockPointerDown(e, b, date)}
                      title="끌어서 옮기기 · 눌러서 고치기"
                    >
                      <span className="schedule-block-title">{b.label}</span>
                      <span className="schedule-block-time">
                        {formatMinutes(start)}~{formatMinutes(end)}
                      </span>
                      <span className="schedule-block-resize" aria-hidden />
                    </div>
                  )
                })}

              {drag?.kind === 'create' && drag.date === date && (
                <div className="schedule-block preview" style={{ top: toPx(drag.start), height: toPx(drag.end - drag.start) }}>
                  <span className="schedule-block-time">
                    {formatMinutes(drag.start)}~{formatMinutes(drag.end)}
                  </span>
                </div>
              )}

              {date === today && <div className="schedule-now" style={{ top: toPx(now) }} aria-label="지금" />}

              {popover && (popover.kind === 'new' ? popover.date : popover.block.date) === date && (
                <SchedulePopover
                  popover={popover}
                  goals={goalsOf(date)}
                  run={run}
                  onClose={() => setPopover(null)}
                  onStartFocus={date === today ? onStartFocus : undefined}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

type PopoverProps = {
  popover: NonNullable<Popover>
  goals: DailyGoal[]
  run: Run
  onClose: () => void
  onStartFocus?: (goal: DailyGoal) => void
}

/** 블록 추가·수정 팝업. 블록 바로 옆(위치)에 띄운다. */
function SchedulePopover({ popover, goals, run, onClose, onStartFocus }: PopoverProps) {
  const date = popover.kind === 'new' ? popover.date : popover.block.date
  const start = popover.kind === 'new' ? popover.start : minutesOfDay(popover.block.startAt, date)
  const end = popover.kind === 'new' ? popover.end : minutesOfDay(popover.block.endAt, date)
  const choosable = popover.kind === 'new' ? goals.filter((g) => g.status === 'TODO') : goals
  const goal = popover.kind === 'edit' ? goals.find((g) => g.id === popover.block.dailyGoalId) : undefined

  // 아래쪽이면 팝업이 잘리지 않게 블록 위로 올린다
  const style = start > 18 * 60 ? { bottom: `calc(100% - ${toPx(start)}px + 4px)` } : { top: toPx(end) + 4 }

  return (
    <div
      className="schedule-popover card"
      style={style}
      onPointerDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-label={popover.kind === 'new' ? '시간 블록 추가' : '시간 블록 수정'}
    >
      <div className="daily-panel-head">
        <strong className="small">
          {popover.kind === 'new' ? '새 시간 블록' : popover.block.label} · {dayLabel(date)}
        </strong>
        <button className="icon" onClick={onClose} aria-label="닫기">
          ×
        </button>
      </div>
      {choosable.length === 0 && popover.kind === 'new' && (
        <p className="muted small">이 날의 할 일 목표가 없어서 목표 아닌 일정만 넣을 수 있어요.</p>
      )}
      <TimeBlockForm
        date={date}
        goals={choosable}
        allowFree
        dailyGoalId={popover.kind === 'edit' ? popover.block.dailyGoalId : (choosable[0]?.id ?? null)}
        title={popover.kind === 'edit' ? popover.block.title : null}
        startMinutes={start}
        endMinutes={end}
        submitLabel={popover.kind === 'new' ? '추가' : '저장'}
        onSubmit={(input) =>
          run(() => (popover.kind === 'new' ? createTimeBlock(input) : updateTimeBlock(popover.block.id, input))).then(
            (ok) => ok && onClose(),
          )
        }
        onCancel={onClose}
        onDelete={
          popover.kind === 'edit'
            ? () => run(() => deleteTimeBlock(popover.block.id)).then((ok) => ok && onClose())
            : undefined
        }
      />
      {goal && goal.status === 'TODO' && onStartFocus && (
        <button className="start-focus" onClick={() => onStartFocus(goal)}>
          ▶ 지금 집중 시작
        </button>
      )}
    </div>
  )
}
