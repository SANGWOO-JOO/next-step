import { useEffect, useState, type FormEvent } from 'react'
import type { Category } from '../api/categories'
import {
  MAX_CORE,
  changeDailyGoalType,
  createDailyGoal,
  deleteDailyGoal,
  moveDailyGoal,
  reorderDailyGoals,
  toDailyGoalUpdateInput,
  updateDailyGoal,
  type DailyGoal,
  type DailyGoalType,
} from '../api/dailyGoals'
import { getWeeklyGoalsOfWeek, type WeeklyGoal } from '../api/goals'
import { createTimeBlock, type TimeBlock } from '../api/timeBlocks'
import { dayLabel, formatMinutes, minutesOfDay, mondayOf, nowMinutesSeoul, shiftDate, todaySeoul } from '../utils/date'
import CategoryBadge from './CategoryBadge'
import FormButtons from './FormButtons'
import { GOAL_DRAG_TYPE } from './ScheduleView'
import TimeBlockForm from './TimeBlockForm'

/** 변경 요청을 실행하고 화면 데이터를 다시 불러온다. 성공 여부를 돌려준다. */
type Run = (action: () => Promise<unknown>) => Promise<boolean>

type Props = {
  date: string
  /** 그날의 하루 목표 */
  goals: DailyGoal[]
  /** 그 주의 주간 목표 (하루 목표를 연결할 대상) */
  weeklyGoals: WeeklyGoal[]
  categories: Category[]
  run: Run
  title?: string
  onClose?: () => void
  /** 넘기면 하루 목표마다 시간 블록을 보여주고 '+ 시간'으로 블록을 만든다 */
  timeBlocks?: TimeBlock[]
  /** 넘기면 미완료 목표마다 ▶ 버튼으로 집중 세션을 시작한다 */
  onStartFocus?: (goal: DailyGoal) => void
}

/** 하루의 핵심(최대 3개)·추가 목표를 보여주고 추가·완료·넘기기·전환을 한다. */
export default function DailyGoalPanel({
  date,
  goals,
  weeklyGoals,
  categories,
  run,
  title,
  onClose,
  timeBlocks,
  onStartFocus,
}: Props) {
  const [notice, setNotice] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const core = goals.filter((g) => g.type === 'CORE')
  const extra = goals.filter((g) => g.type === 'EXTRA')

  const section = (type: DailyGoalType, list: DailyGoal[]) =>
    list.map((goal, i) => (
      <DailyGoalItem
        key={goal.id}
        goal={goal}
        canBeCore={core.length < MAX_CORE}
        onMoveUp={i > 0 ? () => run(() => reorder(type, list, i, -1)) : undefined}
        onMoveDown={i < list.length - 1 ? () => run(() => reorder(type, list, i, 1)) : undefined}
        categories={categories}
        run={run}
        onNotice={setNotice}
        blocks={timeBlocks?.filter((b) => b.dailyGoalId === goal.id)}
        nextBlockStart={nextBlockStart(date, timeBlocks)}
        onStartFocus={onStartFocus}
      />
    ))

  const reorder = (type: DailyGoalType, list: DailyGoal[], index: number, delta: number) => {
    const ids = list.map((g) => g.id)
    ;[ids[index], ids[index + delta]] = [ids[index + delta], ids[index]]
    return reorderDailyGoals(date, type, ids)
  }

  return (
    <div className="daily-panel">
      <div className="daily-panel-head">
        <h3>{title ?? dayLabel(date)}</h3>
        {onClose && (
          <button className="icon" onClick={onClose} aria-label="닫기">
            ×
          </button>
        )}
      </div>
      {notice && (
        <p className="notice small" role="status">
          {notice}
        </p>
      )}

      <h4 className="muted small">
        핵심 ({core.length}/{MAX_CORE})
      </h4>
      {core.length === 0 && <p className="muted small">꼭 끝낼 일을 3개 이내로 골라보세요.</p>}
      {section('CORE', core)}

      <h4 className="muted small">추가</h4>
      {extra.length === 0 && <p className="muted small">여유가 있으면 할 일</p>}
      {section('EXTRA', extra)}

      {weeklyGoals.length === 0 ? (
        <p className="muted small">이 주의 주간 목표가 없어요. 먼저 주간 목표를 추가해야 하루 목표를 연결할 수 있어요.</p>
      ) : adding ? (
        <NewDailyGoalForm
          date={date}
          weeklyGoals={weeklyGoals}
          categories={categories}
          onSubmit={(input) =>
            run(() => createDailyGoal(input)).then((ok) => {
              if (ok) setAdding(false)
            })
          }
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button className="ghost add" onClick={() => setAdding(true)}>
          + 하루 목표
        </button>
      )}
    </div>
  )
}

/** 새 블록의 기본 시작: 오늘이면 지금 이후 30분 단위, 아니면 09:00. 그날 마지막 블록 뒤로 밀어준다. */
function nextBlockStart(date: string, blocks: TimeBlock[] | undefined) {
  const base = date === todaySeoul() ? Math.ceil(nowMinutesSeoul() / 30) * 30 : 9 * 60
  const lastEnd = Math.max(0, ...(blocks ?? []).map((b) => minutesOfDay(b.endAt, date)))
  return Math.min(Math.max(base, lastEnd), 1410)
}

type ItemProps = {
  goal: DailyGoal
  canBeCore: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
  categories: Category[]
  run: Run
  onNotice: (message: string | null) => void
  /** undefined면 시간 블록 기능을 숨긴다 */
  blocks?: TimeBlock[]
  nextBlockStart: number
  onStartFocus?: (goal: DailyGoal) => void
}

function DailyGoalItem({
  goal,
  canBeCore,
  onMoveUp,
  onMoveDown,
  categories,
  run,
  onNotice,
  blocks,
  nextBlockStart,
  onStartFocus,
}: ItemProps) {
  const [mode, setMode] = useState<'view' | 'edit' | 'move' | 'block'>('view')
  const done = goal.status === 'DONE'
  const tomorrow = shiftDate(goal.date, 1)

  const toggleDone = () =>
    run(() => updateDailyGoal(goal.id, { ...toDailyGoalUpdateInput(goal), status: done ? 'TODO' : 'DONE' }))

  const move = (date: string, weeklyGoalId: number | null) =>
    run(async () => {
      const result = await moveDailyGoal(goal.id, date, weeklyGoalId)
      const messages = [
        result.downgradedToExtra
          ? `${dayLabel(date)}은 핵심이 이미 ${MAX_CORE}개라 '${goal.content}'을(를) 추가 목록에 넣었어요.`
          : `'${goal.content}'을(를) ${dayLabel(date)}로 넘겼어요.`,
      ]
      if (result.removedTimeBlocks > 0) messages.push(`잡아 둔 시간 블록 ${result.removedTimeBlocks}개는 지웠어요.`)
      onNotice(messages.join(' '))
    })

  // 같은 주의 내일이면 바로 넘기고, 다음 주로 넘어가면 주간 목표를 고르게 한다
  const moveTomorrow = () =>
    mondayOf(tomorrow) === mondayOf(goal.date) ? move(tomorrow, null) : setMode('move')

  const remove = () => {
    if (confirm(`'${goal.content}' 하루 목표를 삭제할까요?`)) run(() => deleteDailyGoal(goal.id))
  }

  if (mode === 'edit') {
    return (
      <EditDailyGoalForm
        goal={goal}
        categories={categories}
        onSubmit={(input) => run(() => updateDailyGoal(goal.id, input)).then((ok) => ok && setMode('view'))}
        onCancel={() => setMode('view')}
      />
    )
  }

  return (
    <div
      className="daily-item"
      draggable={!!blocks && !done}
      onDragStart={(e) => e.dataTransfer.setData(GOAL_DRAG_TYPE, String(goal.id))}
      title={blocks && !done ? '시간표로 끌어다 놓으면 1시간 블록이 생겨요' : undefined}
    >
      <div className="daily-row">
        <input type="checkbox" checked={done} onChange={toggleDone} aria-label="완료" />
        {onStartFocus && !done && (
          <button className="start-focus" onClick={() => onStartFocus(goal)} title="집중 시작" aria-label="집중 시작">
            ▶
          </button>
        )}
        <span className={done ? 'daily-content done' : 'daily-content'}>
          {goal.content}
          {goal.carryCount > 0 && (
            <span className="carry" title={`${goal.carryCount}번 넘긴 목표`}>
              ↻{goal.carryCount}
            </span>
          )}
        </span>
        {goal.category ? (
          <CategoryBadge name={goal.category.name} color={goal.category.color} inactive={!goal.category.active} />
        ) : (
          <span className="muted small">미분류</span>
        )}
        <span className="row-actions daily-actions">
          <button className="icon" disabled={!onMoveUp} onClick={onMoveUp} aria-label="위로">
            ↑
          </button>
          <button className="icon" disabled={!onMoveDown} onClick={onMoveDown} aria-label="아래로">
            ↓
          </button>
          {!done && (
            <button className="ghost" onClick={moveTomorrow}>
              내일로
            </button>
          )}
          {goal.type === 'EXTRA' ? (
            <button
              className="ghost"
              disabled={!canBeCore}
              title={canBeCore ? undefined : `핵심은 ${MAX_CORE}개까지예요`}
              onClick={() => run(() => changeDailyGoalType(goal.id, 'CORE'))}
            >
              핵심으로
            </button>
          ) : (
            <button className="ghost" onClick={() => run(() => changeDailyGoalType(goal.id, 'EXTRA'))}>
              추가로
            </button>
          )}
          {!done && (
            <button className="ghost" onClick={() => setMode('move')}>
              옮기기
            </button>
          )}
          {blocks && !done && (
            <button className="ghost" onClick={() => setMode('block')}>
              + 시간
            </button>
          )}
          <button className="ghost" onClick={() => setMode('edit')}>
            수정
          </button>
          <button className="danger" onClick={remove}>
            삭제
          </button>
        </span>
      </div>
      <div className="daily-meta muted small">
        {goal.firstAction && <span>→ 첫 행동: {goal.firstAction}</span>}
        <span>주간: {goal.weeklyGoalContent}</span>
        {blocks?.map((b) => (
          <span key={b.id} className="block-chip">
            🕘 {formatMinutes(minutesOfDay(b.startAt, goal.date))}~{formatMinutes(minutesOfDay(b.endAt, goal.date))}
          </span>
        ))}
      </div>
      {mode === 'block' && (
        <TimeBlockForm
          date={goal.date}
          goals={[goal]}
          dailyGoalId={goal.id}
          startMinutes={nextBlockStart}
          endMinutes={Math.min(nextBlockStart + 60, 1440)}
          submitLabel="시간 잡기"
          onSubmit={(input) => run(() => createTimeBlock(input)).then((ok) => ok && setMode('view'))}
          onCancel={() => setMode('view')}
        />
      )}
      {mode === 'move' && (
        <MoveForm
          goal={goal}
          initialDate={tomorrow}
          onSubmit={(date, weeklyGoalId) => move(date, weeklyGoalId).then((ok) => ok && setMode('view'))}
          onCancel={() => setMode('view')}
        />
      )}
    </div>
  )
}

type MoveFormProps = {
  goal: DailyGoal
  initialDate: string
  onSubmit: (date: string, weeklyGoalId: number | null) => void
  onCancel: () => void
}

/** 날짜를 고르고, 다른 주면 그 주의 주간 목표를 고른다. */
function MoveForm({ goal, initialDate, onSubmit, onCancel }: MoveFormProps) {
  const [date, setDate] = useState(initialDate)
  const [weekly, setWeekly] = useState<{ weekStart: string; goals: WeeklyGoal[] } | null>(null)
  const [pickedId, setPickedId] = useState<number | null>(null)
  const otherWeek = date !== '' && mondayOf(date) !== mondayOf(goal.date)
  const weekStart = date === '' ? '' : mondayOf(date)

  // 다른 주를 고르면 그 주의 주간 목표를 불러온다
  useEffect(() => {
    if (!otherWeek) return
    let cancelled = false
    getWeeklyGoalsOfWeek(weekStart)
      .catch(() => [] as WeeklyGoal[])
      .then((goals) => {
        if (!cancelled) setWeekly({ weekStart, goals })
      })
    return () => {
      cancelled = true
    }
  }, [otherWeek, weekStart])

  // 불러오는 중이면 null
  const weekGoals = weekly?.weekStart === weekStart ? weekly.goals : null
  const weeklyGoalId = weekGoals?.find((w) => w.id === pickedId)?.id ?? weekGoals?.[0]?.id ?? null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit(date, otherWeek ? weeklyGoalId : null)
  }

  return (
    <form className="inline-form tree-form" onSubmit={submit}>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required aria-label="넘길 날짜" />
      {otherWeek &&
        (weekGoals === null ? (
          <span className="muted small">주간 목표 불러오는 중…</span>
        ) : weekGoals.length > 0 ? (
          <select
            value={weeklyGoalId ?? ''}
            onChange={(e) => setPickedId(Number(e.target.value))}
            aria-label="연결할 주간 목표"
          >
            {weekGoals.map((w) => (
              <option key={w.id} value={w.id}>
                {w.content}
              </option>
            ))}
          </select>
        ) : (
          <span className="muted small">그 주에 주간 목표가 없어요. 먼저 추가해 주세요.</span>
        ))}
      <button type="submit" disabled={otherWeek && weeklyGoalId === null}>
        넘기기
      </button>
      <button type="button" className="ghost" onClick={onCancel}>
        취소
      </button>
    </form>
  )
}

type NewFormProps = {
  date: string
  weeklyGoals: WeeklyGoal[]
  categories: Category[]
  onSubmit: (input: Parameters<typeof createDailyGoal>[0]) => void
  onCancel: () => void
}

function NewDailyGoalForm({ date, weeklyGoals, categories, onSubmit, onCancel }: NewFormProps) {
  const [weeklyGoalId, setWeeklyGoalId] = useState(weeklyGoals[0].id)
  const [content, setContent] = useState('')
  const [firstAction, setFirstAction] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [type, setType] = useState<DailyGoalType | null>(null)
  const inherited = weeklyGoals.find((w) => w.id === weeklyGoalId)?.category

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit({ weeklyGoalId, date, content, firstAction: firstAction.trim() || null, categoryId, type })
  }

  return (
    <form className="stack-form daily-form" onSubmit={submit}>
      <div className="inline-form">
        <input
          className="grow"
          placeholder="예: 경력 1번 프로젝트 성과 정리"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
        />
        <input
          className="grow"
          placeholder="첫 행동 (예: 노션 열고 제목만 쓰기)"
          value={firstAction}
          onChange={(e) => setFirstAction(e.target.value)}
        />
      </div>
      <div className="inline-form">
        <select
          value={weeklyGoalId}
          onChange={(e) => setWeeklyGoalId(Number(e.target.value))}
          aria-label="연결할 주간 목표"
        >
          {weeklyGoals.map((w) => (
            <option key={w.id} value={w.id}>
              주간: {w.content}
            </option>
          ))}
        </select>
        <CategorySelect
          categories={categories}
          value={categoryId}
          onChange={setCategoryId}
          emptyLabel={inherited ? `주간 목표 분류 (${inherited.name})` : '주간 목표 분류 (미분류)'}
        />
        <select
          value={type ?? ''}
          onChange={(e) => setType(e.target.value === '' ? null : (e.target.value as DailyGoalType))}
          aria-label="유형"
        >
          <option value="">자동 (핵심 자리가 있으면 핵심)</option>
          <option value="CORE">핵심</option>
          <option value="EXTRA">추가</option>
        </select>
        <FormButtons submitLabel="추가" onCancel={onCancel} />
      </div>
    </form>
  )
}

type EditFormProps = {
  goal: DailyGoal
  categories: Category[]
  onSubmit: (input: ReturnType<typeof toDailyGoalUpdateInput>) => void
  onCancel: () => void
}

function EditDailyGoalForm({ goal, categories, onSubmit, onCancel }: EditFormProps) {
  const [content, setContent] = useState(goal.content)
  const [firstAction, setFirstAction] = useState(goal.firstAction ?? '')
  const [categoryId, setCategoryId] = useState<number | null>(goal.category?.id ?? null)

  // 이미 지정된 비활성 분류는 선택지에 남겨 둔다
  const options =
    goal.category && !categories.some((c) => c.id === goal.category?.id)
      ? [...categories, { ...goal.category, sortOrder: 0, targetRatio: null, weeklyTargetMinutes: null }]
      : categories

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit({ content, firstAction: firstAction.trim() || null, categoryId, status: goal.status })
  }

  return (
    <form className="inline-form tree-form" onSubmit={submit}>
      <input className="grow" value={content} onChange={(e) => setContent(e.target.value)} required aria-label="내용" />
      <input
        className="grow"
        placeholder="첫 행동"
        value={firstAction}
        onChange={(e) => setFirstAction(e.target.value)}
      />
      <CategorySelect categories={options} value={categoryId} onChange={setCategoryId} emptyLabel="미분류" />
      <FormButtons submitLabel="저장" onCancel={onCancel} />
    </form>
  )
}

type CategorySelectProps = {
  categories: Category[]
  value: number | null
  onChange: (value: number | null) => void
  emptyLabel: string
}

function CategorySelect({ categories, value, onChange, emptyLabel }: CategorySelectProps) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      aria-label="분류"
    >
      <option value="">{emptyLabel}</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.active ? c.name : `${c.name} (비활성)`}
        </option>
      ))}
    </select>
  )
}
