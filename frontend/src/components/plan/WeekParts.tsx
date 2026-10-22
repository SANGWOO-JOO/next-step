import { useState, type FormEvent } from 'react'
import type { Category } from '../../api/categories'
import type { DailyGoal } from '../../api/dailyGoals'
import { formatDuration } from '../../api/focus'
import {
  createWeeklyGoal,
  deleteWeeklyGoal,
  toWeeklyInput,
  updateWeeklyGoal,
  type MonthlyGoal,
  type WeeklyGoal,
} from '../../api/goals'
import { CONDITION_LABELS } from '../../api/records'
import { studySeconds, type WeeklyJournal } from '../../api/reviews'
import { createWeeklyPlan, type WeeklyPlan } from '../../api/weeklyPlans'
import { dayLabel, todaySeoul } from '../../utils/date'
import { healthOf, weekRange } from '../../utils/health'
import CategoryBadge from '../CategoryBadge'
import HealthDot from '../HealthDot'
import MoreMenu from '../MoreMenu'
import WeeklyGoalForm from '../WeeklyGoalForm'
import WeeklyPlanItem, { PLAN_DRAG_TYPE } from '../WeeklyPlanItem'

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
  plans: WeeklyPlan[]
  dailyGoals: DailyGoal[]
  weeklyGoals: WeeklyGoal[]
  weekDates: string[]
  run: Run
  /** 강조 중인 주간 목표. 다른 목표의 계획은 흐리게 */
  highlightGoalId?: number | null
  /** 다른 요일의 계획 카드를 이 날로 끌어 놓았을 때 */
  onDropPlan?: (planId: number, date: string) => void
}

export function DayColumn({
  date,
  today,
  plans,
  dailyGoals,
  weeklyGoals,
  weekDates,
  run,
  highlightGoalId,
  onDropPlan,
}: DayProps) {
  const [over, setOver] = useState(false)
  const [adding, setAdding] = useState(false)
  const [content, setContent] = useState('')
  const [pickedId, setPickedId] = useState<number | null>(null)
  const weeklyGoalId = weeklyGoals.find((w) => w.id === pickedId)?.id ?? weeklyGoals[0]?.id

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!weeklyGoalId) return
    run(() => createWeeklyPlan({ weeklyGoalId, date, content })).then((ok) => {
      if (ok) {
        setContent('')
        setAdding(false)
      }
    })
  }

  return (
    <div
      className={['card day-column', today ? 'today' : '', over ? 'drop-over' : ''].join(' ')}
      onDragOver={(e) => {
        if (!onDropPlan || !e.dataTransfer.types.includes(PLAN_DRAG_TYPE)) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false)
        const id = Number(e.dataTransfer.getData(PLAN_DRAG_TYPE))
        if (id && onDropPlan) {
          e.preventDefault()
          onDropPlan(id, date)
        }
      }}
    >
      <div className="daily-panel-head">
        <strong className={today ? 'day-today' : undefined}>{dayLabel(date).replace(/^\d+월 /, '')}</strong>
        <span className="muted small" title="하루 목표 완료/전체">
          {dailyGoals.filter((d) => d.status === 'DONE').length}/{dailyGoals.length}
        </span>
      </div>
      <ul className="plan-list">
        {plans.map((p) => (
          <WeeklyPlanItem
            key={p.id}
            plan={p}
            hasDailyGoal={dailyGoals.some((d) => d.content === p.content)}
            run={run}
            weekDates={weekDates}
            dimmed={highlightGoalId != null && p.weeklyGoalId !== highlightGoalId}
          />
        ))}
      </ul>
      {adding ? (
        <form className="stack-form" onSubmit={submit}>
          {weeklyGoals.length > 1 && (
            <select value={weeklyGoalId} onChange={(e) => setPickedId(Number(e.target.value))} aria-label="주간 목표">
              {weeklyGoals.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.content}
                </option>
              ))}
            </select>
          )}
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="할 일"
            required
            maxLength={500}
            autoFocus
          />
          <span className="row-actions">
            <button type="submit">추가</button>
            <button type="button" className="ghost" onClick={() => setAdding(false)}>
              취소
            </button>
          </span>
        </form>
      ) : (
        <button className="ghost add" disabled={weeklyGoals.length === 0} onClick={() => setAdding(true)}>
          + 계획
        </button>
      )}
    </div>
  )
}

/** 이번 주 요일별 공부 시간, 목표 완료, 컨디션 */
export function WeekSummary({ journal }: { journal: WeeklyJournal }) {
  const t = journal.total
  const max = Math.max(1, ...journal.days.map((d) => studySeconds(d.summary)))
  return (
    <div className="card">
      <h3 className="timeline-title">요일별 기록</h3>
      <dl className="result-stats">
        <dt>공부 합계</dt>
        <dd>{formatDuration(studySeconds(t))}</dd>
        <dt>딴짓</dt>
        <dd>{formatDuration(t.distractionSeconds)}</dd>
        <dt>하루 목표</dt>
        <dd>
          {t.goalsDone}/{t.goalsTotal} 완료
        </dd>
        <dt>주간 목표</dt>
        <dd>
          {t.weeklyGoalsAchieved}/{t.weeklyGoalsTotal} 달성
        </dd>
      </dl>
      <ul className="week-bars">
        {journal.days.map((d) => {
          const seconds = studySeconds(d.summary)
          return (
            <li key={d.date}>
              <span className="muted small">{dayLabel(d.date).slice(-3)}</span>
              <span className="week-bar-track">
                <span className="week-bar-fill" style={{ width: `${(seconds / max) * 100}%` }} />
              </span>
              <span className="small">{seconds > 0 ? formatDuration(seconds) : '-'}</span>
              <span title="컨디션">{d.condition ? CONDITION_LABELS[d.condition] : ''}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

type ChipsProps = GoalListProps & {
  plans: WeeklyPlan[]
  /** 강조 중인 주간 목표 */
  selectedId: number | null
  onSelect: (id: number | null) => void
}

/**
 * 주간 목표 칩 줄(Sunsama 주간 목표 패널 참고). 칩을 누르면 그 목표의 계획만 보드에서 강조한다.
 * 진행은 연결된 하루 목표 완료/전체, 동작은 ⋯ 메뉴.
 */
export function WeekGoalChips({
  monday,
  weeklyGoals,
  monthlyGoals,
  dailyGoals,
  plans,
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
        const planCount = plans.filter((p) => p.weeklyGoalId === w.id).length
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
              title="누르면 이 목표의 계획만 강조해요"
            >
              <HealthDot health={healthOf(percent, from, to, today, w.achieved)} />
              <span className="badge-dot" style={{ background: w.category?.color ?? 'var(--muted)' }} />
              <span className={w.achieved ? 'done' : undefined}>{w.content}</span>
              <span className="muted small">
                {done}/{linked.length} · 계획 {planCount}
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
