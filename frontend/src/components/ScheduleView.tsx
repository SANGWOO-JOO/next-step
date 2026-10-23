import { useEffect, useRef, useState, type DragEvent, type PointerEvent } from 'react'
import {
  changeDailyGoalType,
  deleteDailyGoal,
  moveDailyGoal,
  toDailyGoalUpdateInput,
  updateDailyGoal,
  type DailyGoal,
} from '../api/dailyGoals'
import { actualFromBlock, updateActualLog, type ActualLog } from '../api/actualLogs'
import type { Category } from '../api/categories'
import { createTimeBlock, deleteTimeBlock, toTimeBlockInput, updateTimeBlock, type TimeBlock } from '../api/timeBlocks'
import { dayLabel, formatMinutes, minutesOfDay, mondayOf, nowMinutesSeoul, seoulIso, shiftDate, todaySeoul } from '../utils/date'
import ActualPopover from './ActualPopover'
import MoreMenu from './MoreMenu'
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
  run: Run
  /** 고른 날(왼쪽 목록이 보여주는 날). [주] 보기에서 날짜 머리를 누르면 바뀐다 */
  selectedDate?: string
  onSelectDate?: (date: string) => void
  /** 넘기면 하루 열을 "계획 | 실제" 두 줄로 나눈다(docs/design.md 1-4e) */
  actuals?: ActualLog[]
  categories?: Category[]
  /** 켜면 0시~24시가 스크롤 없이 한 화면에 들어오게 한 시간 높이를 줄인다 */
  fitDay?: boolean
}

/** 드래그 중 상태. create는 빈 칸을 끌어 범위를 고르는 중, move/resize는 블록을 옮기거나 늘이는 중 */
type Lane = 'plan' | 'actual'

type Drag =
  | {
      kind: 'create'
      lane: Lane
      date: string
      anchor: number
      start: number
      end: number
      /** 실제 기록 위에서 시작했으면 그 기록. 끌지 않고 떼면 그 기록을 고친다 */
      from?: ActualLog
      moved?: boolean
    }
  | { kind: 'move' | 'resize'; block: TimeBlock; date: string; grab: number; start: number; end: number; moved: boolean }
  /** 실제 기록 옮기기·늘이기(계획 블록과 같은 방식) */
  | { kind: 'actual-move' | 'actual-resize'; log: ActualLog; date: string; grab: number; start: number; end: number; moved: boolean }

type Popover =
  | { kind: 'new'; date: string; start: number; end: number }
  | { kind: 'edit'; block: TimeBlock }
  | { kind: 'actual'; date: string; start: number; end: number; log?: ActualLog }
  | null

const popoverDate = (p: NonNullable<Popover>) => (p.kind === 'edit' ? p.block.date : p.date)

const snap = (minutes: number) => Math.min(DAY, Math.max(0, Math.round(minutes / SNAP) * SNAP))
/** 지금 쓰는 한 시간 높이. "24시간 한눈에"를 켜면 화면에 맞춰 줄어든다(1-4f ㉕) */
let hourPx = HOUR_PX
const toPx = (minutes: number) => (minutes / 60) * hourPx

/** 이벤트 위치를 그 열의 0시부터의 분으로 */
function minuteAt(e: { clientY: number }, column: HTMLElement) {
  return snap(((e.clientY - column.getBoundingClientRect().top) / hourPx) * 60)
}

/**
 * 맥 캘린더 같은 시간표. 빈 칸을 끌어 블록을 만들고, 블록을 끌어 옮기거나 아래 끝을 끌어 늘인다.
 * 하루 목표를 끌어다 놓으면 1시간 블록이 생기고, 지난 시간에는 실제 집중 세션을 오른쪽에 겹쳐 보여준다.
 */
export default function ScheduleView({
  dates,
  blocks,
  goals,
  run,
  selectedDate,
  onSelectDate,
  actuals,
  categories = [],
  fitDay = false,
}: Props) {
  const twoLane = actuals !== undefined
  // 24시간 한눈에: 스크롤 영역 높이에 맞춰 한 시간 높이를 정한다(최소 16px)
  const [fitHour, setFitHour] = useState(HOUR_PX)
  hourPx = fitDay ? fitHour : HOUR_PX
  const today = todaySeoul()
  const [drag, setDrag] = useState<Drag | null>(null)
  const [popover, setPopover] = useState<Popover>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [now, setNow] = useState(nowMinutesSeoul)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scroller.current
    if (!fitDay || !el) return
    const measure = () => {
      const head = el.querySelector<HTMLElement>('.schedule-head')?.offsetHeight ?? 0
      setFitHour(Math.max(16, Math.floor((el.clientHeight - head - 4) / 24)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [fitDay, dates.length])

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
    // 두 줄일 때는 오른쪽 반이 "실제" 줄
    const rect = e.currentTarget.getBoundingClientRect()
    const lane: Lane = twoLane && e.clientX - rect.left > rect.width / 2 ? 'actual' : 'plan'
    setPopover(null)
    setDrag({ kind: 'create', lane, date, anchor: m, start: m, end: m + SNAP })
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
      const moved = drag.moved || m !== drag.anchor
      setDrag({ ...drag, start, end: Math.min(end, DAY), moved })
    } else if (drag.kind === 'move' || drag.kind === 'actual-move') {
      const length = drag.end - drag.start
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
    if (drag.kind === 'create' && drag.from && !drag.moved) {
      // 실제 기록을 누르기만 했으면 그 기록 고치기
      const a = drag.from
      setPopover({ kind: 'actual', date: drag.date, start: minutesOfDay(a.startAt, drag.date), end: minutesOfDay(a.endAt, drag.date), log: a })
      return
    }
    if (drag.kind === 'create') {
      // 그냥 누르기만 했으면 1시간짜리로
      const end = drag.end - drag.start <= SNAP ? Math.min(drag.start + 60, DAY) : drag.end
      setPopover(
        drag.lane === 'actual'
          ? { kind: 'actual', date: drag.date, start: drag.start, end }
          : { kind: 'new', date: drag.date, start: drag.start, end },
      )
      return
    }
    if (drag.kind === 'actual-move' || drag.kind === 'actual-resize') {
      const a = drag.log
      if (!drag.moved) {
        setPopover({ kind: 'actual', date: drag.date, start: drag.start, end: drag.end, log: a })
        return
      }
      run(() =>
        updateActualLog(a.id, {
          date: a.date,
          startAt: seoulIso(drag.date, drag.start),
          endAt: seoulIso(drag.date, drag.end),
          kind: a.kind,
          dailyGoalId: a.dailyGoalId,
          categoryId: a.category?.id ?? null,
          title: a.title,
        }),
      )
      return
    }
    if (drag.kind !== 'move' && drag.kind !== 'resize') return
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
      {/* 머리(날짜·목표 줄)도 같은 스크롤 영역 안에 둬야 세로 스크롤바 폭만큼 열이 어긋나지 않는다 */}
      <div className="schedule-scroll" ref={scroller}>
      <div className="schedule-head" style={{ gridTemplateColumns: `3rem repeat(${dates.length}, minmax(0, 1fr))` }}>
        <span />
        {dates.map((d) =>
          week && onSelectDate ? (
            <button
              key={d}
              type="button"
              className={['schedule-date', d === today ? 'today' : '', d === selectedDate ? 'selected' : ''].join(' ')}
              onClick={() => onSelectDate(d)}
              aria-pressed={d === selectedDate}
              title="이 날의 할 일을 왼쪽에 보여줘요"
            >
              {dayLabel(d).replace(/^\d+월 /, '')}
            </button>
          ) : (
            <span key={d} className={d === today ? 'schedule-date today' : 'schedule-date'}>
              {week ? dayLabel(d).replace(/^\d+월 /, '') : dayLabel(d)}
            </span>
          ),
        )}
        {twoLane && (
          <>
            <span />
            {dates.map((d) => (
              <span key={d} className="lane-labels muted">
                <span>계획</span>
                <span>실제</span>
              </span>
            ))}
          </>
        )}
        <span className="schedule-allday-label muted">목표</span>
        {dates.map((d) => (
          <div key={d} className="schedule-allday">
            {[...goalsOf(d)].sort((a, b) => Number(b.type === 'CORE') - Number(a.type === 'CORE')).map((g) => (
              <GoalChip
                key={g.id}
                goal={g}
                run={run}
                coreFull={goalsOf(d).filter((x) => x.type === 'CORE').length >= 3}
              />
            ))}
          </div>
        ))}
      </div>

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
              className={['schedule-column', date === today ? 'today' : '', twoLane ? 'two-lane' : ''].join(' ')}
              style={{ backgroundSize: `100% ${hourPx}px, 100% ${hourPx / 2}px` }}
              onPointerDown={(e) => onColumnPointerDown(e, date)}
              onPointerMove={onColumnPointerMove}
              onPointerUp={onColumnPointerUp}
              onPointerCancel={() => setDrag(null)}
              onDragOver={(e) => e.dataTransfer.types.includes(GOAL_DRAG_TYPE) && e.preventDefault()}
              onDrop={(e) => onDrop(e, date)}
            >
              {blocks
                .filter((b) => b.date === date)
                .map((b) => {
                  const dragging = (drag?.kind === 'move' || drag?.kind === 'resize') && drag.block.id === b.id ? drag : null
                  const start = dragging?.start ?? minutesOfDay(b.startAt, date)
                  const end = dragging?.end ?? minutesOfDay(b.endAt, date)
                  // 목표 아닌 일정은 회색 점선 테두리로 구분한다
                  const color = b.category?.color ?? 'var(--muted)'
                  // 칸 높이에 맞춰 줄인다(1-4f ㉖): 한 줄이 안 되면 tiny, 세 줄이 안 되면 short(제목·시간 한 줄)
                  const px = toPx(end - start)
                  const size = px < 30 ? 'tiny' : px < 66 ? 'short' : ''
                  const past = date < today || (date === today && end <= now)
                  // 지난 계획인데 그 시간에 실제 기록이 하나도 없으면 [계획대로]를 보여준다
                  const unrecorded =
                    twoLane &&
                    past &&
                    !actuals!.some(
                      (a) => a.date === date && minutesOfDay(a.startAt, date) < end && minutesOfDay(a.endAt, date) > start,
                    )
                  return (
                    <div
                      key={b.id}
                      className={[
                        'schedule-block',
                        b.dailyGoalStatus === 'DONE' ? 'done' : '',
                        b.dailyGoalId === null ? 'free' : '',
                        dragging ? 'dragging' : '',
                        size,
                        date === today && start <= now && now < end ? 'now' : '',
                        twoLane ? 'plan-lane' : '',
                        unrecorded ? 'unrecorded' : '',
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
                      <span className="schedule-block-title" title={`${b.label} · ${formatMinutes(start)}~${formatMinutes(end)}`}>
                        {b.label}
                      </span>
                      {size !== 'tiny' && (
                        <span className="schedule-block-time">
                          {formatMinutes(start)}~{formatMinutes(end)}
                        </span>
                      )}
                      {unrecorded && (
                        <button
                          type="button"
                          className={size ? 'as-planned compact' : 'as-planned'}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => run(() => actualFromBlock(b.id))}
                          title="계획대로: 이 계획대로 했다고 실제 줄에 기록해요"
                          aria-label="계획대로"
                        >
                          {size ? '✓' : '✓ 계획대로'}
                        </button>
                      )}
                      <span className="schedule-block-resize" aria-hidden />
                    </div>
                  )
                })}

              {twoLane &&
                actuals!
                  .filter((a) => a.date === date)
                  .map((a) => {
                    const dragging =
                      (drag?.kind === 'actual-move' || drag?.kind === 'actual-resize') && drag.log.id === a.id ? drag : null
                    const start = dragging?.start ?? minutesOfDay(a.startAt, date)
                    const end = dragging?.end ?? minutesOfDay(a.endAt, date)
                    const color = a.category?.color ?? 'var(--muted)'
                    // 계획과 같은 일이면 ✓, 계획에 없던 일이면 ＋, 딴짓이면 ⚠
                    const planned = blocks.some(
                      (b) =>
                        b.date === date &&
                        (b.id === a.timeBlockId || (a.dailyGoalId !== null && b.dailyGoalId === a.dailyGoalId)) &&
                        minutesOfDay(b.startAt, date) < end &&
                        minutesOfDay(b.endAt, date) > start,
                    )
                    const mark = a.kind === 'DISTRACTION' ? '⚠' : planned ? '✓' : '＋'
                    return (
                      <div
                        key={a.id}
                        className={[
                          'actual-entry',
                          `actual-${a.kind.toLowerCase()}`,
                          toPx(end - start) < 30 ? 'tiny' : toPx(end - start) < 44 ? 'short' : '',
                          dragging ? 'dragging' : '',
                        ].join(' ')}
                        style={{
                          top: toPx(start),
                          height: Math.max(toPx(end - start) - 2, 14),
                          borderLeftColor: a.kind === 'DISTRACTION' ? 'var(--down)' : color,
                          background:
                            a.kind === 'DISTRACTION' || a.kind === 'OTHER'
                              ? undefined
                              : `color-mix(in srgb, ${color} 30%, var(--surface))`,
                        }}
                        onPointerDown={(e) => {
                          // 계획 블록처럼 누르면 고치기, 끌면 옮기기, 아래 끝은 늘이기.
                          // Shift를 누르고 끌면 그 위에 새 기록(딴짓 덧붙이기 등). 새 기록이 겹친 부분을 잘라낸다
                          if (e.button !== 0) return
                          e.stopPropagation()
                          const column = e.currentTarget.closest<HTMLElement>('.schedule-column')!
                          column.setPointerCapture(e.pointerId)
                          const m = Math.min(minuteAt(e, column), DAY - SNAP)
                          setPopover(null)
                          if (e.shiftKey) {
                            setDrag({ kind: 'create', lane: 'actual', date, anchor: m, start: m, end: m + SNAP, from: a, moved: false })
                            return
                          }
                          const resize = e.clientY > e.currentTarget.getBoundingClientRect().bottom - RESIZE_ZONE
                          setDrag({
                            kind: resize ? 'actual-resize' : 'actual-move',
                            log: a,
                            date,
                            grab: minuteAt(e, column) - start,
                            start,
                            end,
                            moved: false,
                          })
                        }}
                        title={`실제: ${a.label} ${formatMinutes(start)}~${formatMinutes(end)} · 누르면 고치기, 끌면 옮기기, 아래 끝을 끌면 늘이기, Shift+끌기는 그 위에 새로 기록`}
                      >
                        <span className="schedule-block-title">
                          <span className="actual-mark">{mark}</span> {a.label}
                        </span>
                        <span className="schedule-block-time">
                          {formatMinutes(start)}~{formatMinutes(end)}
                        </span>
                        <span className="schedule-block-resize" aria-hidden />
                      </div>
                    )
                  })}

              {drag?.kind === 'create' && drag.date === date && (
                <div
                  className={['schedule-block preview', twoLane ? (drag.lane === 'actual' ? 'actual-lane' : 'plan-lane') : ''].join(' ')}
                  style={{ top: toPx(drag.start), height: toPx(drag.end - drag.start) }}
                >
                  <span className="schedule-block-time">
                    {formatMinutes(drag.start)}~{formatMinutes(drag.end)}
                  </span>
                </div>
              )}

              {date === today && <div className="schedule-now" style={{ top: toPx(now) }} aria-label="지금" />}

              {popover?.kind === 'actual' && popover.date === date && (
                <ActualPopover
                  key={`${popover.log?.id ?? 'new'}-${popover.start}`}
                  date={date}
                  start={popover.start}
                  end={popover.end}
                  log={popover.log}
                  goals={goalsOf(date)}
                  categories={categories}
                  run={run}
                  onClose={() => setPopover(null)}
                  style={
                    popover.start > 18 * 60
                      ? { bottom: `calc(100% - ${toPx(popover.start)}px + 4px)`, left: 'auto', right: '0.5rem' }
                      : { top: toPx(popover.end) + 4, left: 'auto', right: '0.5rem' }
                  }
                />
              )}

              {popover && popover.kind !== 'actual' && popoverDate(popover) === date && (
                <SchedulePopover
                  popover={popover}
                  goals={goalsOf(date)}
                  run={run}
                  onClose={() => setPopover(null)}
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
  popover: Extract<NonNullable<Popover>, { kind: 'new' } | { kind: 'edit' }>
  goals: DailyGoal[]
  run: Run
  onClose: () => void
}

/** 블록 추가·수정 팝업. 블록 바로 옆(위치)에 띄운다. */
function SchedulePopover({ popover, goals, run, onClose }: PopoverProps) {
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
      {goal && (
        <span className="row-actions">
          <button
            className="ghost"
            onClick={() =>
              run(() =>
                updateDailyGoal(goal.id, { ...toDailyGoalUpdateInput(goal), status: goal.status === 'DONE' ? 'TODO' : 'DONE' }),
              ).then((ok) => ok && onClose())
            }
          >
            {goal.status === 'DONE' ? '완료 취소' : '✓ 목표 완료'}
          </button>
        </span>
      )}
    </div>
  )
}

type ChipProps = {
  goal: DailyGoal
  run: Run
  /** 그날 핵심이 이미 3개면 '핵심으로'를 막는다 */
  coreFull: boolean
}

/**
 * 시간표 위쪽 "목표" 줄의 칩(docs/design.md 6장 시간표 중심). 할 일 목록 역할:
 * 완료 체크, ▶ 집중(오늘만), ⋯ 메뉴, 끌어서 시간표에 놓으면 1시간 블록.
 */
function GoalChip({ goal, run, coreFull }: ChipProps) {
  const done = goal.status === 'DONE'
  const tomorrow = shiftDate(goal.date, 1)
  const sameWeek = mondayOf(tomorrow) === mondayOf(goal.date)

  return (
    <span
      className={done ? 'schedule-goal done' : 'schedule-goal'}
      draggable={!done}
      onDragStart={(e) => e.dataTransfer.setData(GOAL_DRAG_TYPE, String(goal.id))}
      style={{ borderLeftColor: goal.category?.color ?? 'var(--muted)' }}
      title={done ? '완료한 목표' : `${goal.firstAction ? `첫 행동: ${goal.firstAction} · ` : ''}시간표로 끌어다 놓으면 1시간 블록이 생겨요`}
    >
      <input
        type="checkbox"
        checked={done}
        onChange={() => run(() => updateDailyGoal(goal.id, { ...toDailyGoalUpdateInput(goal), status: done ? 'TODO' : 'DONE' }))}
        aria-label="완료"
      />
      <span className="schedule-goal-text">
        {goal.content}
      </span>
      <MoreMenu
        label="목표 동작"
        items={[
          { label: '내일로', onClick: () => run(() => moveDailyGoal(goal.id, tomorrow)), show: !done && sameWeek },
          goal.type === 'EXTRA'
            ? { label: '핵심으로', onClick: () => run(() => changeDailyGoalType(goal.id, 'CORE')), disabled: coreFull }
            : { label: '추가로', onClick: () => run(() => changeDailyGoalType(goal.id, 'EXTRA')) },
          {
            label: '삭제',
            danger: true,
            onClick: () => confirm(`'${goal.content}' 하루 목표를 삭제할까요?`) && run(() => deleteDailyGoal(goal.id)),
          },
        ]}
      />
    </span>
  )
}
