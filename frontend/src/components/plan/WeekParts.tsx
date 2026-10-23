import { useState, type FormEvent } from 'react'
import type { Category } from '../../api/categories'
import { createDailyGoal, deleteDailyGoal, toDailyGoalUpdateInput, updateDailyGoal, type DailyGoal } from '../../api/dailyGoals'
import { formatDuration } from '../../api/focus'
import {
  createWeeklyGoal,
  deleteWeeklyGoal,
  toWeeklyInput,
  updateWeeklyGoal,
  type MonthlyGoal,
  type WeeklyGoal,
} from '../../api/goals'
import { dayLabel, todaySeoul } from '../../utils/date'
import { healthOf, weekRange } from '../../utils/health'
import CategoryBadge from '../CategoryBadge'
import HealthDot from '../HealthDot'
import MoreMenu from '../MoreMenu'
import WeeklyGoalForm from '../WeeklyGoalForm'

type Run = (action: () => Promise<unknown>) => Promise<boolean>

type GoalListProps = {
  monday: string
  weeklyGoals: WeeklyGoal[]
  /** 이 주가 속한 달의 월간 목표(주간 목표를 연결할 대상) */
  monthlyGoals: MonthlyGoal[]
  dailyGoals: DailyGoal[]
  categories: Category[]
  run: Run
}

/** 주간 목표 목록. 그 자리에서 추가·수정·달성 체크를 한다. 상태 색은 연결된 하루 목표 완료율로 정한다. */
export function WeekGoalList({ monday, weeklyGoals, monthlyGoals, dailyGoals, categories, run }: GoalListProps) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [pickedId, setPickedId] = useState<number | null>(null)
  const monthlyGoalId = monthlyGoals.find((m) => m.id === pickedId)?.id ?? monthlyGoals[0]?.id
  const today = todaySeoul()
  const { from, to } = weekRange(monday)

  return (
    <div className="week-goals">
      {weeklyGoals.length === 0 && <p className="muted small">이 주의 주간 목표가 없어요.</p>}
      <ul className="unfinished-list">
        {weeklyGoals.map((w) => {
          const month = monthlyGoals.find((m) => m.id === w.monthlyGoalId)?.month ?? monday.slice(0, 7)
          if (editingId === w.id) {
            return (
              <li key={w.id}>
                <WeeklyGoalForm
                  month={month}
                  categories={categories}
                  initial={w}
                  showWeek={false}
                  submitLabel="저장"
                  onSubmit={(input) => run(() => updateWeeklyGoal(w.id, input)).then((ok) => ok && setEditingId(null))}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            )
          }
          const linked = dailyGoals.filter((d) => d.weeklyGoalId === w.id)
          const done = linked.filter((d) => d.status === 'DONE').length
          const percent = linked.length ? Math.round((done / linked.length) * 100) : 0
          return (
            <li key={w.id}>
              <input
                type="checkbox"
                checked={w.achieved}
                onChange={() => run(() => updateWeeklyGoal(w.id, { ...toWeeklyInput(w), achieved: !w.achieved }))}
                aria-label="달성"
              />
              <HealthDot health={healthOf(percent, from, to, today, w.achieved)} />
              <span className={w.achieved ? 'done' : undefined}>{w.content}</span>
              {w.category && <CategoryBadge name={w.category.name} color={w.category.color} inactive={!w.category.active} />}
              <span className="muted small">
                하루 목표 {done}/{linked.length}
              </span>
              {w.carriedOver && <span className="carry">→ 다음 주로 이어감</span>}
              <span className="row-actions daily-actions">
                <button className="ghost" onClick={() => setEditingId(w.id)}>
                  수정
                </button>
                <button
                  className="danger"
                  onClick={() => confirm(`'${w.content}' 주간 목표를 삭제할까요?`) && run(() => deleteWeeklyGoal(w.id))}
                >
                  삭제
                </button>
              </span>
            </li>
          )
        })}
      </ul>
      {adding && monthlyGoalId !== undefined ? (
        <div className="calendar-add">
          {monthlyGoals.length > 1 && (
            <select value={monthlyGoalId} onChange={(e) => setPickedId(Number(e.target.value))} aria-label="연결할 월간 목표">
              {monthlyGoals.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.content}
                </option>
              ))}
            </select>
          )}
          <WeeklyGoalForm
            month={monthlyGoals.find((m) => m.id === monthlyGoalId)!.month}
            categories={categories}
            defaultWeekStart={monday}
            showWeek={false}
            submitLabel="추가"
            onSubmit={(input) => run(() => createWeeklyGoal(monthlyGoalId, input)).then((ok) => ok && setAdding(false))}
            onCancel={() => setAdding(false)}
          />
        </div>
      ) : monthlyGoals.length > 0 ? (
        <button className="ghost add" onClick={() => setAdding(true)}>
          + 주간 목표
        </button>
      ) : (
        <p className="muted small">이 주가 속한 달의 월간 목표가 없어요. [월] 보기에서 먼저 만들어 주세요.</p>
      )}
    </div>
  )
}

type DayProps = {
  date: string
  today: boolean
  dailyGoals: DailyGoal[]
  weeklyGoals: WeeklyGoal[]
  run: Run
  /** 강조 중인 주간 목표. 다른 목표의 할 일은 흐리게 */
  highlightGoalId?: number | null
  /** 다른 요일의 카드를 이 날로 끌어 놓았을 때 */
  onDropGoal?: (goalId: number, date: string) => void
  /** 넘기면 머리에 그날 공부 시간과 막대(주 최대 대비)를 보여준다(1-4f ⑩) */
  study?: { seconds: number; max: number }
}

/** 주 보드 카드를 다른 요일로 끌 때 쓰는 dataTransfer 형식 */
export const DAY_GOAL_DRAG_TYPE = 'application/x-day-goal'

/**
 * 주 보드의 하루 칸. 여기 적은 것이 곧 그날 하루 목표다(1-4f, 계획 카드와 하루 목표를 합침).
 * 미리 적은 것은 일반으로 넣고 핵심은 그날 정한다(Sunsama: 요일마다 미리 채우기를 권하지 않음).
 */
export function DayColumn({ date, today, dailyGoals, weeklyGoals, run, highlightGoalId, onDropGoal, study }: DayProps) {
  const [over, setOver] = useState(false)
  const [adding, setAdding] = useState(false)
  const [content, setContent] = useState('')
  const [pickedId, setPickedId] = useState<number | null | undefined>(undefined)
  // 고르지 않았으면 강조 중인 목표, 없으면 첫 주간 목표에 연결
  const weeklyGoalId = pickedId !== undefined ? pickedId : (highlightGoalId ?? weeklyGoals[0]?.id ?? null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    run(() =>
      createDailyGoal({ weeklyGoalId, date, content, firstAction: null, categoryId: null, type: 'EXTRA' }),
    ).then((ok) => {
      if (ok) {
        setContent('')
        setAdding(false)
      }
    })
  }

  const toggle = (g: DailyGoal) =>
    run(() => updateDailyGoal(g.id, { ...toDailyGoalUpdateInput(g), status: g.status === 'DONE' ? 'TODO' : 'DONE' }))

  return (
    <div
      className={['card day-column', today ? 'today' : '', over ? 'drop-over' : ''].join(' ')}
      onDragOver={(e) => {
        if (!onDropGoal || !e.dataTransfer.types.includes(DAY_GOAL_DRAG_TYPE)) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false)
        const id = Number(e.dataTransfer.getData(DAY_GOAL_DRAG_TYPE))
        if (id && onDropGoal) {
          e.preventDefault()
          onDropGoal(id, date)
        }
      }}
    >
      <div className="daily-panel-head">
        <strong className={today ? 'day-today' : undefined}>{dayLabel(date).replace(/^\d+월 /, '')}</strong>
        <span className="muted small" title="완료/전체">
          {dailyGoals.filter((d) => d.status === 'DONE').length}/{dailyGoals.length}
        </span>
      </div>
      {study && (
        <span className="day-study" title="그날 공부 시간">
          <span className="goal-bar">
            <span className="goal-bar-fill accent" style={{ width: `${(study.seconds / Math.max(1, study.max)) * 100}%` }} />
          </span>
          <span className="muted small">{formatDuration(study.seconds)}</span>
        </span>
      )}
      <ul className="plan-list">
        {dailyGoals.map((g) => (
          <li
            key={g.id}
            className={highlightGoalId != null && g.weeklyGoalId !== highlightGoalId ? 'plan-card dimmed' : 'plan-card'}
            style={{ borderLeftColor: g.category?.color ?? 'var(--muted)' }}
            draggable={g.status !== 'DONE' && !!onDropGoal}
            onDragStart={(e) => e.dataTransfer.setData(DAY_GOAL_DRAG_TYPE, String(g.id))}
            title={g.weeklyGoalContent ? `주간 목표: ${g.weeklyGoalContent}` : '주간 목표에 연결 안 됨'}
          >
            <input type="checkbox" checked={g.status === 'DONE'} onChange={() => toggle(g)} aria-label="완료" />
            <span className={g.status === 'DONE' ? 'plan-content done' : 'plan-content'}>
              {g.type === 'CORE' && <span className="core-mark">★ </span>}
              {g.content}
            </span>
            <MoreMenu
              label="할 일 동작"
              items={[
                {
                  label: '삭제',
                  danger: true,
                  onClick: () => confirm(`'${g.content}'을(를) 삭제할까요?`) && run(() => deleteDailyGoal(g.id)),
                },
              ]}
            />
          </li>
        ))}
      </ul>
      {adding ? (
        <form className="stack-form" onSubmit={submit}>
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="할 일"
            required
            maxLength={500}
            autoFocus
          />
          {weeklyGoals.length > 0 && (
            <select
              value={weeklyGoalId ?? ''}
              onChange={(e) => setPickedId(e.target.value === '' ? null : Number(e.target.value))}
              aria-label="주간 목표"
            >
              <option value="">주간 목표 연결 안 함</option>
              {weeklyGoals.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.content}
                </option>
              ))}
            </select>
          )}
          <span className="row-actions">
            <button type="submit">추가</button>
            <button type="button" className="ghost" onClick={() => setAdding(false)}>
              취소
            </button>
          </span>
        </form>
      ) : (
        <button className="ghost add" onClick={() => setAdding(true)}>
          + 할 일
        </button>
      )}
    </div>
  )
}

type ChipsProps = GoalListProps & {
  /** 강조 중인 주간 목표 */
  selectedId: number | null
  onSelect: (id: number | null) => void
}

/**
 * 주간 목표 칩 줄(Sunsama 주간 목표 패널 참고). 칩을 누르면 그 목표의 할 일만 보드에서 강조한다.
 * 진행은 연결된 하루 목표 완료/전체, 동작은 ⋯ 메뉴.
 */
export function WeekGoalChips({
  monday,
  weeklyGoals,
  monthlyGoals,
  dailyGoals,
  categories,
  run,
  selectedId,
  onSelect,
}: ChipsProps) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [pickedId, setPickedId] = useState<number | null>(null)
  const monthlyGoalId = monthlyGoals.find((m) => m.id === pickedId)?.id ?? monthlyGoals[0]?.id
  const today = todaySeoul()
  const { from, to } = weekRange(monday)
  const editing = weeklyGoals.find((w) => w.id === editingId)

  return (
    <div className="week-chips">
      <span className="muted small">이번 주 목표</span>
      {weeklyGoals.map((w) => {
        const linked = dailyGoals.filter((d) => d.weeklyGoalId === w.id)
        const done = linked.filter((d) => d.status === 'DONE').length
        const percent = linked.length ? Math.round((done / linked.length) * 100) : 0
        return (
          <span
            key={w.id}
            className={['week-chip', selectedId === w.id ? 'selected' : '', w.achieved ? 'achieved' : ''].join(' ')}
          >
            <button
              type="button"
              className="week-chip-main"
              onClick={() => onSelect(selectedId === w.id ? null : w.id)}
              aria-pressed={selectedId === w.id}
              title="누르면 이 목표의 할 일만 강조해요"
            >
              <HealthDot health={healthOf(percent, from, to, today, w.achieved)} />
              <span className="badge-dot" style={{ background: w.category?.color ?? 'var(--muted)' }} />
              <span className={w.achieved ? 'done' : undefined}>{w.content}</span>
              <span className="muted small">
                {done}/{linked.length}
              </span>
              {w.carriedOver && <span className="carry">→ 다음 주</span>}
            </button>
            <MoreMenu
              label="주간 목표 동작"
              items={[
                {
                  label: w.achieved ? '달성 취소' : '달성',
                  onClick: () => run(() => updateWeeklyGoal(w.id, { ...toWeeklyInput(w), achieved: !w.achieved })),
                },
                { label: '수정', onClick: () => setEditingId(w.id) },
                {
                  label: '삭제',
                  danger: true,
                  onClick: () => confirm(`'${w.content}' 주간 목표를 삭제할까요?`) && run(() => deleteWeeklyGoal(w.id)),
                },
              ]}
            />
          </span>
        )
      })}
      {monthlyGoals.length > 0 ? (
        <button className="ghost week-chip-add" onClick={() => setAdding(true)}>
          + 주간 목표
        </button>
      ) : (
        <span className="muted small">이 주가 속한 달의 월간 목표가 먼저 있어야 해요.</span>
      )}

      {editing && (
        <div className="week-chip-form">
          <WeeklyGoalForm
            month={monthlyGoals.find((m) => m.id === editing.monthlyGoalId)?.month ?? monday.slice(0, 7)}
            categories={categories}
            initial={editing}
            showWeek={false}
            submitLabel="저장"
            onSubmit={(input) => run(() => updateWeeklyGoal(editing.id, input)).then((ok) => ok && setEditingId(null))}
            onCancel={() => setEditingId(null)}
          />
        </div>
      )}
      {adding && monthlyGoalId !== undefined && (
        <div className="week-chip-form">
          {monthlyGoals.length > 1 && (
            <select value={monthlyGoalId} onChange={(e) => setPickedId(Number(e.target.value))} aria-label="연결할 월간 목표">
              {monthlyGoals.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.content}
                </option>
              ))}
            </select>
          )}
          <WeeklyGoalForm
            month={monthlyGoals.find((m) => m.id === monthlyGoalId)!.month}
            categories={categories}
            defaultWeekStart={monday}
            showWeek={false}
            submitLabel="추가"
            onSubmit={(input) => run(() => createWeeklyGoal(monthlyGoalId, input)).then((ok) => ok && setAdding(false))}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}
    </div>
  )
}
