import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getCategories, type Category } from '../api/categories'
import { errorMessage } from '../api/client'
import {
  GOAL_STATUS_LABEL,
  createGoal,
  createMonthlyGoal,
  createWeeklyGoal,
  deleteGoal,
  deleteMonthlyGoal,
  deleteWeeklyGoal,
  getGoals,
  updateGoal,
  updateMonthlyGoal,
  updateWeeklyGoal,
  type Goal,
  type GoalInput,
  type GoalStatus,
  type MonthlyGoal,
  type MonthlyGoalInput,
  type WeeklyGoal,
  toWeeklyInput,
} from '../api/goals'
import CategoryBadge from '../components/CategoryBadge'
import FormButtons from '../components/FormButtons'
import GoalCalendar from '../components/GoalCalendar'
import ProgressBar from '../components/ProgressBar'
import WeeklyGoalForm from '../components/WeeklyGoalForm'
import { currentMonthSeoul, monthLabel, todaySeoul, weekLabel } from '../utils/date'

/** 변경 요청을 실행하고 목록을 다시 불러온다. 성공 여부를 돌려준다. */
type Run = (action: () => Promise<unknown>) => Promise<boolean>

const toNumberOrNull = (value: string) => (value.trim() === '' ? null : Number(value))
const toTextOrNull = (value: string) => (value.trim() === '' ? null : value)

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[] | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  // 보기 방식과 캘린더 달은 주소에 남겨 새로고침해도 유지한다
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'calendar' ? 'calendar' : 'tree'
  const calendarMonth = params.get('month') ?? currentMonthSeoul()
  const setView = (next: 'tree' | 'calendar') =>
    setParams(next === 'calendar' ? { view: next, month: calendarMonth } : {}, { replace: true })

  const load = useCallback(() => {
    Promise.all([getGoals(), getCategories()])
      .then(([g, c]) => {
        setGoals(g)
        setCategories(c)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [])

  useEffect(load, [load])

  const run: Run = async (action) => {
    setError(null)
    try {
      await action()
      load()
      return true
    } catch (e) {
      setError(errorMessage(e))
      return false
    }
  }

  return (
    <section>
      <div className="page-title">
        <h1>최종 목표</h1>
        <span className="row-actions">
          <span className="segmented" role="group" aria-label="보기 방식">
            <button className={view === 'tree' ? 'active' : ''} onClick={() => setView('tree')}>
              트리
            </button>
            <button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}>
              캘린더
            </button>
          </span>
          {!adding && <button onClick={() => setAdding(true)}>+ 최종 목표</button>}
        </span>
      </div>
      <p className="muted">최종 목표 → 월간 목표 → 주간 목표 순으로 연결해요. 진행률은 하위 목표 달성 비율로 자동 계산돼요.</p>
      {error && (
        <p className="error-banner" role="alert">
          {error}
          <button className="icon" onClick={() => setError(null)} aria-label="닫기">
            ×
          </button>
        </p>
      )}

      {adding && (
        <div className="card">
          <h2>새 최종 목표</h2>
          <GoalForm
            submitLabel="추가"
            onSubmit={(input) => run(() => createGoal(input)).then((ok) => ok && setAdding(false))}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      {goals?.length === 0 && !adding && <p className="card muted">아직 최종 목표가 없어요. 이직 목표부터 적어보세요.</p>}
      {view === 'tree' &&
        goals?.map((goal) => <GoalCard key={goal.id} goal={goal} categories={categories} run={run} />)}
      {view === 'calendar' && goals && goals.length > 0 && (
        <GoalCalendar
          goals={goals}
          categories={categories}
          month={calendarMonth}
          onMonthChange={(month) => setParams({ view: 'calendar', month }, { replace: true })}
          onToggleMonthly={(m) => run(() => updateMonthlyGoal(m.id, { ...monthlyInput(m), achieved: !m.achieved }))}
          onToggleWeekly={(w) => run(() => updateWeeklyGoal(w.id, { ...toWeeklyInput(w), achieved: !w.achieved }))}
          onAddWeekly={(monthlyGoalId, input) => run(() => createWeeklyGoal(monthlyGoalId, input))}
        />
      )}
    </section>
  )
}

// ---- 최종 목표 ----

function GoalCard({ goal, categories, run }: { goal: Goal; categories: Category[]; run: Run }) {
  const [open, setOpen] = useState(goal.status === 'ACTIVE')
  const [editing, setEditing] = useState(false)
  const [addingMonthly, setAddingMonthly] = useState(false)

  const remove = () => {
    if (confirm(`'${goal.title}' 최종 목표를 삭제할까요?`)) run(() => deleteGoal(goal.id))
  }

  return (
    <article className={`card goal goal-${goal.status.toLowerCase()}`}>
      {editing ? (
        <GoalForm
          initial={goal}
          submitLabel="저장"
          onSubmit={(input) => run(() => updateGoal(goal.id, input)).then((ok) => ok && setEditing(false))}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="goal-header">
          <button className="icon" onClick={() => setOpen(!open)} aria-label={open ? '접기' : '펼치기'}>
            {open ? '▾' : '▸'}
          </button>
          <div className="goal-title">
            <h2>{goal.title}</h2>
            <span className="muted small">
              {goal.startDate} ~ {goal.targetDate} · <span className="status-tag">{GOAL_STATUS_LABEL[goal.status]}</span>
            </span>
          </div>
          <ProgressBar progress={goal.progress} />
          <span className="row-actions">
            <button className="ghost" onClick={() => setEditing(true)}>
              수정
            </button>
            <button className="danger" onClick={remove}>
              삭제
            </button>
          </span>
        </div>
      )}
      {!editing && goal.description && <p className="muted goal-description">{goal.description}</p>}

      {open && (
        <div className="tree">
          {goal.monthlyGoals.map((m) => (
            <MonthlyGoalItem key={m.id} monthly={m} goal={goal} categories={categories} run={run} />
          ))}
          {addingMonthly ? (
            <MonthlyGoalForm
              goal={goal}
              submitLabel="추가"
              onSubmit={(input) =>
                run(() => createMonthlyGoal(goal.id, input)).then((ok) => ok && setAddingMonthly(false))
              }
              onCancel={() => setAddingMonthly(false)}
            />
          ) : (
            <button className="ghost add" onClick={() => setAddingMonthly(true)}>
              + 월간 목표
            </button>
          )}
        </div>
      )}
    </article>
  )
}

type GoalFormProps = {
  initial?: Goal
  submitLabel: string
  onSubmit: (input: GoalInput) => void
  onCancel: () => void
}

function GoalForm({ initial, submitLabel, onSubmit, onCancel }: GoalFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [startDate, setStartDate] = useState(initial?.startDate ?? todaySeoul())
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? '')
  const [status, setStatus] = useState<GoalStatus>(initial?.status ?? 'ACTIVE')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit({ title, description: toTextOrNull(description), startDate, targetDate, status })
  }

  return (
    <form className="stack-form" onSubmit={submit}>
      <input placeholder="예: 백엔드 개발자로 이직" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <div className="inline-form">
        <label>
          시작일 <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </label>
        <label>
          목표일{' '}
          <input
            type="date"
            value={targetDate}
            min={startDate}
            onChange={(e) => setTargetDate(e.target.value)}
            required
          />
        </label>
        {initial && (
          <select value={status} onChange={(e) => setStatus(e.target.value as GoalStatus)} aria-label="상태">
            {Object.entries(GOAL_STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
      </div>
      <textarea
        placeholder="설명 (선택)"
        rows={2}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <FormButtons submitLabel={submitLabel} onCancel={onCancel} />
    </form>
  )
}

// ---- 월간 목표 ----

type MonthlyItemProps = { monthly: MonthlyGoal; goal: Goal; categories: Category[]; run: Run }

function MonthlyGoalItem({ monthly, goal, categories, run }: MonthlyItemProps) {
  const [editing, setEditing] = useState(false)
  const [addingWeekly, setAddingWeekly] = useState(false)

  const toggleAchieved = () =>
    run(() => updateMonthlyGoal(monthly.id, { ...monthlyInput(monthly), achieved: !monthly.achieved }))

  const remove = () => {
    if (confirm(`'${monthly.content}' 월간 목표를 삭제할까요?`)) run(() => deleteMonthlyGoal(monthly.id))
  }

  return (
    <div className="tree-node">
      {editing ? (
        <MonthlyGoalForm
          goal={goal}
          initial={monthly}
          submitLabel="저장"
          onSubmit={(input) => run(() => updateMonthlyGoal(monthly.id, input)).then((ok) => ok && setEditing(false))}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="tree-row">
          <input type="checkbox" checked={monthly.achieved} onChange={toggleAchieved} aria-label="달성" />
          <span className="tree-label">{monthLabel(monthly.month)}</span>
          <span className={monthly.achieved ? 'tree-content done' : 'tree-content'}>
            {monthly.content}
            {monthly.targetValue !== null && (
              <span className="muted small">
                {' '}
                ({monthly.currentValue ?? 0} / {monthly.targetValue}
                {monthly.unit ?? ''})
              </span>
            )}
          </span>
          <ProgressBar progress={monthly.progress} />
          <span className="row-actions">
            <button className="ghost" onClick={() => setEditing(true)}>
              수정
            </button>
            <button className="danger" onClick={remove}>
              삭제
            </button>
          </span>
        </div>
      )}

      <div className="tree">
        {monthly.weeklyGoals.map((w) => (
          <WeeklyGoalItem key={w.id} weekly={w} month={monthly.month} categories={categories} run={run} />
        ))}
        {addingWeekly ? (
          <WeeklyGoalForm
            month={monthly.month}
            categories={categories}
            submitLabel="추가"
            onSubmit={(input) =>
              run(() => createWeeklyGoal(monthly.id, input)).then((ok) => ok && setAddingWeekly(false))
            }
            onCancel={() => setAddingWeekly(false)}
          />
        ) : (
          <button className="ghost add" onClick={() => setAddingWeekly(true)}>
            + 주간 목표
          </button>
        )}
      </div>
    </div>
  )
}

const monthlyInput = (m: MonthlyGoal): MonthlyGoalInput => ({
  month: m.month,
  content: m.content,
  targetValue: m.targetValue,
  currentValue: m.currentValue,
  unit: m.unit,
  achieved: m.achieved,
})

type MonthlyFormProps = {
  goal: Goal
  initial?: MonthlyGoal
  submitLabel: string
  onSubmit: (input: MonthlyGoalInput) => void
  onCancel: () => void
}

function MonthlyGoalForm({ goal, initial, submitLabel, onSubmit, onCancel }: MonthlyFormProps) {
  const minMonth = goal.startDate.slice(0, 7)
  const maxMonth = goal.targetDate.slice(0, 7)
  const thisMonth = currentMonthSeoul()
  const defaultMonth = thisMonth < minMonth ? minMonth : thisMonth > maxMonth ? maxMonth : thisMonth

  const [month, setMonth] = useState(initial?.month ?? defaultMonth)
  const [content, setContent] = useState(initial?.content ?? '')
  const [currentValue, setCurrentValue] = useState(initial?.currentValue?.toString() ?? '')
  const [targetValue, setTargetValue] = useState(initial?.targetValue?.toString() ?? '')
  const [unit, setUnit] = useState(initial?.unit ?? '')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit({
      month,
      content,
      currentValue: toNumberOrNull(currentValue),
      targetValue: toNumberOrNull(targetValue),
      unit: toTextOrNull(unit),
      achieved: initial?.achieved ?? false,
    })
  }

  return (
    <form className="inline-form tree-form" onSubmit={submit}>
      <input
        type="month"
        value={month}
        min={minMonth}
        max={maxMonth}
        onChange={(e) => setMonth(e.target.value)}
        required
        aria-label="월"
      />
      <input
        className="grow"
        placeholder="예: 이력서 완성, 지원 10곳"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        required
      />
      <span className="muted small">수치(선택)</span>
      <input
        className="narrow"
        type="number"
        step="any"
        placeholder="현재"
        value={currentValue}
        onChange={(e) => setCurrentValue(e.target.value)}
      />
      /
      <input
        className="narrow"
        type="number"
        step="any"
        placeholder="목표"
        value={targetValue}
        onChange={(e) => setTargetValue(e.target.value)}
      />
      <input className="narrow" placeholder="단위" value={unit} onChange={(e) => setUnit(e.target.value)} />
      <FormButtons submitLabel={submitLabel} onCancel={onCancel} />
    </form>
  )
}

// ---- 주간 목표 ----

type WeeklyItemProps = { weekly: WeeklyGoal; month: string; categories: Category[]; run: Run }

function WeeklyGoalItem({ weekly, month, categories, run }: WeeklyItemProps) {
  const [editing, setEditing] = useState(false)

  const toggleAchieved = () =>
    run(() => updateWeeklyGoal(weekly.id, { ...toWeeklyInput(weekly), achieved: !weekly.achieved }))

  const remove = () => {
    if (confirm(`'${weekly.content}' 주간 목표를 삭제할까요?`)) run(() => deleteWeeklyGoal(weekly.id))
  }

  if (editing) {
    return (
      <WeeklyGoalForm
        month={month}
        categories={categories}
        initial={weekly}
        submitLabel="저장"
        onSubmit={(input) => run(() => updateWeeklyGoal(weekly.id, input)).then((ok) => ok && setEditing(false))}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <div className="tree-row">
      <input type="checkbox" checked={weekly.achieved} onChange={toggleAchieved} aria-label="달성" />
      <span className="tree-label">{weekLabel(weekly.weekStart)}</span>
      <span className={weekly.achieved ? 'tree-content done' : 'tree-content'}>{weekly.content}</span>
      {weekly.category ? (
        <CategoryBadge name={weekly.category.name} color={weekly.category.color} inactive={!weekly.category.active} />
      ) : (
        <span className="muted small">미분류</span>
      )}
      <span className="row-actions">
        <button className="ghost" onClick={() => setEditing(true)}>
          수정
        </button>
        <button className="danger" onClick={remove}>
          삭제
        </button>
      </span>
    </div>
  )
}

