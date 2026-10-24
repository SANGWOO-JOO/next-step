import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { errorMessage } from '../../api/client'
import {
  changeGoalStatus,
  createGoal,
  deleteGoal,
  getGoals,
  getWeekPlan,
  GOAL_STATUS_LABEL,
  MAX_ACTIVE_GOALS,
  updateGoal,
  type Goal,
  type GoalInput,
  type GoalWeekRow,
  type WeekPlan,
} from '../../api/goals'
import { mondayOf, shiftDate, todaySeoul } from '../../utils/date'
import chevronLeft from '../../assets/icons/chevron-left.svg'
import chevronRight from '../../assets/icons/chevron-right.svg'
import IconButton from '../../components/IconButton'
import MoreMenu from '../../components/MoreMenu'
import GoalIconPicker from '../../components/GoalIconPicker'
import { autoGoalIcon, goalIconUrl } from '../../goalIcons'
import { availableColors } from '../../utils/categoryColors'
import type { Run } from './planData'

/** 분 → "3시간 30분", "45분", "0분" */
const hoursLabel = (minutes: number) => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}분`
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`
}

/** "10월 19일 – 25일", 달이 바뀌면 "10월 26일 – 11월 1일" */
const weekTitle = (monday: string) => {
  const sunday = shiftDate(monday, 6)
  const md = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일`
  return sunday.slice(5, 7) === monday.slice(5, 7) ? `${md(monday)} – ${Number(sunday.slice(8))}일` : `${md(monday)} – ${md(sunday)}`
}

/** 기한까지 남은 날: "D-12", 당일 "D-day", 지나면 "기한 지남" */
const dday = (targetDate: string) => {
  const days = Math.round((Date.parse(targetDate) - Date.parse(todaySeoul())) / 86_400_000)
  return days > 0 ? `D-${days}` : days === 0 ? 'D-day' : '기한 지남'
}

/**
 * 계획 화면(docs/design.md 11-4): "이번 주에 무엇을 얼마나 할까요?". 계획은 무엇을 얼마나, 언제는 일정에서 정한다.
 * 목표마다 이번 주 목표 시간을 −/+로 정하고, 일정에 잡은 시간·실제로 한 시간과 나란히 본다.
 * 주소에 week(그 주의 월요일)를 남겨 새로고침에도 유지한다.
 */
export default function PlanPage() {
  const [params, setParams] = useSearchParams()
  const thisMonday = mondayOf(todaySeoul())
  const monday = mondayOf(params.get('week') ?? thisMonday)
  const [plan, setPlan] = useState<WeekPlan | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [showPast, setShowPast] = useState(false)

  const load = useCallback(() => {
    Promise.all([getWeekPlan(monday), getGoals()])
      .then(([p, g]) => {
        setPlan(p)
        setGoals(g)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [monday])

  useEffect(load, [load])

  const run: Run = async (action) => {
    setError(null)
    try {
      await action()
      return true
    } catch (e) {
      setError(errorMessage(e))
      return false
    } finally {
      load()
    }
  }

  const goWeek = (m: string) => setParams(m === thisMonday ? {} : { week: m })

  const active = goals.filter((g) => g.status === 'ACTIVE')
  const past = goals.filter((g) => g.status !== 'ACTIVE')
  const rows = plan?.goals.filter((r) => r.goal.status === 'ACTIVE') ?? []
  // 지난 목표인데 이번 주에 시간이 남아 있는 것(완료 전에 잡아 둔 일정 등)
  const pastRows = plan?.goals.filter((r) => r.goal.status !== 'ACTIVE') ?? []
  const full = active.length >= MAX_ACTIVE_GOALS

  return (
    <section className="plan-page">
      <div className="plan-header cal-header">
        <div>
          <h1 className="plan-title">이번 주에 무엇을 할까요?</h1>
          <p className="muted small">언제 할지는 일정에서 정하고, 여기서는 이번 주에 쓴 시간을 봐요.</p>
        </div>
        <span className="cal-nav">
          <button className="ghost" onClick={() => goWeek(thisMonday)} disabled={monday === thisMonday}>
            이번 주
          </button>
          <IconButton icon={chevronLeft} label="이전 주" onClick={() => goWeek(shiftDate(monday, -7))} />
          <strong className="plan-week">{weekTitle(monday)}</strong>
          <IconButton icon={chevronRight} label="다음 주" onClick={() => goWeek(shiftDate(monday, 7))} />
        </span>
      </div>

      {error && (
        <p className="error-banner" role="alert">
          {error}
          <button className="icon" onClick={() => setError(null)} aria-label="닫기">
            ×
          </button>
        </p>
      )}

      {!plan ? (
        <p className="muted">불러오는 중…</p>
      ) : (
        <>
          {/* 쓸 수 있는 시간·남은 시간은 2-3 시작 설정 뒤에 넣는다(2-2 ⑧) */}
          <div className="plan-summary card two">
            <Stat label="일정에 잡은 시간" value={plan.scheduledMinutes} />
            <Stat label="실제로 한 시간" value={plan.actualMinutes} />
          </div>

          {rows.length === 0 && !adding && (
            <div className="plan-empty card">
              <p>진행 중인 목표가 없어요. 이번 주에 집중할 목표를 하나 정해 볼까요?</p>
            </div>
          )}

          <div className="plan-goals">
            {rows.map((row) => (
              <GoalCard key={row.goal.id} row={row} goals={goals} run={run} full={full} />
            ))}
            {pastRows.map((row) => (
              <GoalCard key={row.goal.id} row={row} goals={goals} run={run} full={full} />
            ))}
          </div>

          {adding ? (
            <GoalForm
              goals={goals}
              submitLabel="목표 추가"
              onCancel={() => setAdding(false)}
              onSubmit={(input) => run(() => createGoal(input)).then((ok) => ok && setAdding(false))}
            />
          ) : (
            <button
              className="plan-add"
              onClick={() => setAdding(true)}
              disabled={full}
              title={full ? `진행 중인 목표는 ${MAX_ACTIVE_GOALS}개까지예요. 하나를 완료하거나 지운 뒤 추가해 주세요.` : undefined}
            >
              + 목표 추가 {full && <span className="muted small">(진행 중 {MAX_ACTIVE_GOALS}개까지)</span>}
            </button>
          )}

          {past.length > 0 && (
            <div className="plan-past">
              <button className="ghost" onClick={() => setShowPast(!showPast)} aria-expanded={showPast}>
                {showPast ? '▾' : '▸'} 지난 목표 {past.length}
              </button>
              {showPast && (
                <ul className="plan-past-list">
                  {past.map((g) => (
                    <li key={g.id}>
                      <span className="plan-dot" style={{ background: g.category.color }} aria-hidden="true" />
                      <span className="plan-past-title">{g.title}</span>
                      <span className="muted small">{GOAL_STATUS_LABEL[g.status]}</span>
                      <span className="row-actions">
                        <button
                          className="ghost small"
                          disabled={full}
                          title={full ? `진행 중인 목표는 ${MAX_ACTIVE_GOALS}개까지예요.` : undefined}
                          onClick={() => run(() => changeGoalStatus(g.id, 'ACTIVE'))}
                        >
                          다시 진행
                        </button>
                        <button
                          className="ghost small danger"
                          onClick={() =>
                            confirm(`'${g.title}' 목표를 지울까요? 할 일과 시간 기록은 그대로 남아요. 나중에 같은 이름으로 다시 만들면 지난 기록과 이어져요.`) &&
                            run(() => deleteGoal(g.id))
                          }
                        >
                          지우기
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="plan-stat">
      <span className="muted small">{label}</span>
      <strong>{hoursLabel(value)}</strong>
    </div>
  )
}

type CardProps = { row: GoalWeekRow; goals: Goal[]; run: Run; full: boolean }

/** 목표 한 장: 일정에 잡은 시간, 실제로 한 시간, 일정에 잡기 */
function GoalCard({ row, goals, run, full }: CardProps) {
  const { goal, scheduledMinutes, actualMinutes } = row
  const [editing, setEditing] = useState(false)
  const activeGoal = goal.status === 'ACTIVE'
  const status = (s: Goal['status']) => run(() => changeGoalStatus(goal.id, s))

  if (editing) {
    return (
      <GoalForm
        goals={goals}
        initial={goal}
        submitLabel="저장"
        onCancel={() => setEditing(false)}
        onSubmit={(input) => run(() => updateGoal(goal.id, input)).then((ok) => ok && setEditing(false))}
      />
    )
  }

  return (
    <article className={activeGoal ? 'plan-goal card' : 'plan-goal card inactive'} style={{ borderLeftColor: goal.category.color }}>
      <img className="plan-goal-icon" src={goalIconUrl(goal.icon)} alt="" />
      <div className="plan-goal-main">
        <header className="plan-goal-head">
          <div className="plan-goal-name">
            <strong>{goal.title}</strong>
            {!activeGoal && <span className="plan-badge">{GOAL_STATUS_LABEL[goal.status]}</span>}
            {goal.targetDate && activeGoal && <span className="plan-badge">{dday(goal.targetDate)}</span>}
          </div>
          <MoreMenu
            label={`${goal.title} 메뉴`}
            items={[
              { label: '고치기', onClick: () => setEditing(true) },
              { label: '완료', onClick: () => status('DONE'), show: activeGoal },
              { label: '다시 진행', onClick: () => status('ACTIVE'), show: !activeGoal, disabled: full },
              {
                label: '지우기',
                danger: true,
                onClick: () =>
                  confirm(`'${goal.title}' 목표를 지울까요? 할 일과 시간 기록은 그대로 남아요. 나중에 같은 이름으로 다시 만들면 지난 기록과 이어져요.`) &&
                  run(() => deleteGoal(goal.id)),
              },
            ]}
          />
        </header>

        {/* 목표 시간은 두지 않는다(2-2 추가 결정): 일정에 잡은 시간과 실제로 한 시간만 */}
        <div className="plan-goal-plain">
          {scheduledMinutes + actualMinutes > 0 ? (
            <span className="small">
              일정 <strong>{hoursLabel(scheduledMinutes)}</strong>
              <span className="muted"> · </span>
              실제 <strong>{hoursLabel(actualMinutes)}</strong>
            </span>
          ) : (
            <span className="muted small">이번 주엔 아직 잡은 일정이 없어요</span>
          )}
          {activeGoal && (
            <Link className="plan-schedule-link" to="/">
              일정에 잡기 →
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}

type FormProps = {
  /** 다른 목표의 색을 피해 안 쓴 색 계열을 먼저 보여 준다 */
  goals: Goal[]
  initial?: Goal
  submitLabel: string
  onSubmit: (input: GoalInput) => void
  onCancel: () => void
}

/** 목표 이름, 색, 기한(선택). 분류는 목표와 1:1로 서버가 만든다(2-2 추가 결정) */
function GoalForm({ goals, initial, submitLabel, onSubmit, onCancel }: FormProps) {
  const others = goals.filter((g) => g.id !== initial?.id).map((g) => g.category.color)
  const [colors] = useState(() => {
    const free = availableColors(others)
    return initial && !free.includes(initial.category.color) ? [initial.category.color, ...free] : free
  })
  const [title, setTitle] = useState(initial?.title ?? '')
  const [color, setColor] = useState(initial?.category.color ?? colors[0])
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? '')
  // 직접 고르기 전에는 이름에 맞춰 바뀐다. 고치기는 지금 아이콘을 직접 고른 것으로 본다(2-5 ④)
  const [pickedIcon, setPickedIcon] = useState<string | null | undefined>(initial ? initial.icon : undefined)
  const icon = pickedIcon === undefined ? autoGoalIcon(title) : pickedIcon

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onSubmit({ title: title.trim(), color, targetDate: targetDate || null, icon })
  }

  return (
    <form className="plan-form card" onSubmit={submit}>
      <GoalIconPicker value={icon} title={title} onChange={setPickedIcon} />
      <label>
        <span className="small muted">목표</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 기술 면접 준비" maxLength={50} required autoFocus />
      </label>
      <div className="plan-colors">
        <span className="small muted">색</span>
        <div className="quick-add-swatches" role="radiogroup" aria-label="목표 색">
          {colors.slice(0, 8).map((c, i) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={c === color}
              aria-label={`색 ${i + 1}`}
              className={c === color ? 'swatch on' : 'swatch'}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>
      <label>
        <span className="small muted">기한(선택)</span>
        <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
      </label>
      <span className="row-actions">
        <button type="submit">{submitLabel}</button>
        <button type="button" className="ghost" onClick={onCancel}>
          취소
        </button>
      </span>
    </form>
  )
}
