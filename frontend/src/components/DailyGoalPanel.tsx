import { useState, type FormEvent } from 'react'
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
import { createTimeBlock, type TimeBlock } from '../api/timeBlocks'
import { dayLabel, formatMinutes, minutesOfDay, nowMinutesSeoul, shiftDate, todaySeoul } from '../utils/date'
import FormButtons from './FormButtons'
import addIcon from '../assets/icons/add.svg'
import moreIcon from '../assets/icons/more.svg'
import MoreMenu from './MoreMenu'
import { GOAL_DRAG_TYPE } from './ScheduleView'
import TimeBlockForm from './TimeBlockForm'

/** 변경 요청을 실행하고 화면 데이터를 다시 불러온다. 성공 여부를 돌려준다. */
type Run = (action: () => Promise<unknown>) => Promise<boolean>

type Props = {
  date: string
  /** 그날의 하루 목표 */
  goals: DailyGoal[]
  /** 그 주의 주간 목표 (하루 목표를 연결할 대상) */
  categories: Category[]
  run: Run
  title?: string
  onClose?: () => void
  /** 넘기면 하루 목표마다 시간 블록을 보여주고 '+ 시간'으로 블록을 만든다 */
  timeBlocks?: TimeBlock[]
  /** 넘기면 미완료 목표마다 ▶ 버튼으로 집중 세션을 시작한다 */
}

/** 하루의 핵심(최대 3개)·추가 목표를 보여주고 추가·완료·넘기기·전환을 한다. */
export default function DailyGoalPanel({
  date,
  goals,
  categories,
  run,
  title,
  onClose,
  timeBlocks,
}: Props) {
  const [notice, setNotice] = useState<string | null>(null)
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

      {/* 한 목록으로 보여주고 핵심은 위에 ★로 표시(Todoist·Things처럼 우선순위는 줄 안의 작은 표시로) */}
      {/* 비었을 때 안내 문장은 두지 않는다(입력칸이 안내 역할, 1-4f ㉞). ☆ 설명은 마우스를 올리면 */}
      {goals.length > 0 && (
        <div className="daily-list">
          {section('CORE', core)}
          {section('EXTRA', extra)}
        </div>
      )}

      <NewDailyGoalForm
        key={date}
        date={date}
        categories={categories}
        onSubmit={(input) => run(() => createDailyGoal(input))}
      />
    </div>
  )
}

/** 잡은 시간 합계: 90 → '1시간 30분' */
const formatPlanned = (minutes: number) =>
  [Math.floor(minutes / 60) && `${Math.floor(minutes / 60)}시간`, minutes % 60 && `${minutes % 60}분`].filter(Boolean).join(' ')

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
  /** 그 주의 주간 목표(연결할 대상) */
  nextBlockStart: number
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

  // 다음 주로 넘어가면 주간 목표 연결은 풀린다(1-4f)
  const moveTomorrow = () => move(tomorrow, null)

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
        <button
          type="button"
          className={goal.type === 'CORE' ? 'core-toggle on' : 'core-toggle'}
          onClick={() => run(() => changeDailyGoalType(goal.id, goal.type === 'CORE' ? 'EXTRA' : 'CORE'))}
          disabled={goal.type === 'EXTRA' && !canBeCore}
          aria-pressed={goal.type === 'CORE'}
          aria-label="핵심 목표"
          title={
            goal.type === 'CORE' ? '핵심 목표 (누르면 해제)' : canBeCore ? '핵심 목표로 정하기' : `핵심은 ${MAX_CORE}개까지예요`
          }
        >
          {goal.type === 'CORE' ? '★' : '☆'}
        </button>
        <span
          className={done ? 'daily-content done' : 'daily-content'}
          title={goal.firstAction ? `첫 행동: ${goal.firstAction}` : undefined}
        >
          {goal.content}
          {goal.carryCount > 0 && (
            <span className="carry" title={`${goal.carryCount}번 넘긴 목표`}>
              ↻{goal.carryCount}
            </span>
          )}
        </span>
        {blocks && blocks.length > 0 && (
          <span
            className="daily-time muted small"
            title={blocks
              .map((b) => `${formatMinutes(minutesOfDay(b.startAt, goal.date))}~${formatMinutes(minutesOfDay(b.endAt, goal.date))}`)
              .join('\n')}
          >
            {formatPlanned(blocks.reduce((sum, b) => sum + minutesOfDay(b.endAt, goal.date) - minutesOfDay(b.startAt, goal.date), 0))}
          </span>
        )}
        {goal.category && (
          <span
            className="category-dot"
            style={{ background: goal.category.color }}
            title={goal.category.name}
            aria-label={`분류: ${goal.category.name}`}
          />
        )}
        <MoreMenu
          label="목표 동작"
          items={[
            { label: '+ 시간 잡기', onClick: () => setMode('block'), show: !!blocks && !done },
            { label: '내일로', onClick: moveTomorrow, show: !done },
            { label: '다른 날로 옮기기', onClick: () => setMode('move'), show: !done },
            { label: '위로', onClick: () => onMoveUp?.(), disabled: !onMoveUp },
            { label: '아래로', onClick: () => onMoveDown?.(), disabled: !onMoveDown },
            { label: '수정', onClick: () => setMode('edit') },
            { label: '삭제', onClick: remove, danger: true },
          ]}
        />
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
          initialDate={tomorrow}
          onSubmit={(date, weeklyGoalId) => move(date, weeklyGoalId).then((ok) => ok && setMode('view'))}
          onCancel={() => setMode('view')}
        />
      )}
    </div>
  )
}

type MoveFormProps = {
  initialDate: string
  onSubmit: (date: string, weeklyGoalId: number | null) => void
  onCancel: () => void
}

/** 날짜만 고른다. 주간 목표 연결은 주간 계획 화면에서(1-4f ㊲) */
function MoveForm({ initialDate, onSubmit, onCancel }: MoveFormProps) {
  const [date, setDate] = useState(initialDate)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit(date, null)
  }

  return (
    <form className="inline-form tree-form" onSubmit={submit}>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required aria-label="넘길 날짜" />
      <button type="submit">넘기기</button>
      <button type="button" className="ghost" onClick={onCancel}>
        취소
      </button>
    </form>
  )
}

type NewFormProps = {
  date: string
  categories: Category[]
  /** 성공하면 true. 입력란을 비우고 다음 것을 바로 쓸 수 있게 한다 */
  onSubmit: (input: Parameters<typeof createDailyGoal>[0]) => Promise<boolean>
}

/**
 * 한 줄 빠른 추가(Todoist 빠른 추가 참고). 내용만 쓰고 Enter를 누르면
 * 첫 번째 주간 목표에 연결하고, 분류는 주간 목표에서 물려받고, 핵심 자리가 있으면 핵심으로 넣는다.
 * '자세히'를 누르면 첫 행동·주간 목표·분류·유형을 고를 수 있다.
 */
export function NewDailyGoalForm({ date, categories, onSubmit }: NewFormProps) {
  // 오늘 할 일은 주간 목표와 잇지 않는다. 연결은 주간 계획 화면에서(1-4f ㊲)
  const [content, setContent] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [detailed, setDetailed] = useState(false)

  const reset = () => {
    setContent('')
    setCategoryId(null)
    setDetailed(false)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    onSubmit({ weeklyGoalId: null, date, content, firstAction: null, categoryId, type: null }).then(
      (ok) => ok && reset(),
    )
  }

  return (
    <form
      className={detailed ? 'quick-add detailed' : 'quick-add'}
      onSubmit={submit}
      onKeyDown={(e) => e.key === 'Escape' && reset()}
    >
      <div className="quick-add-row">
        <img className="quick-add-plus" src={addIcon} alt="" aria-hidden="true" width={18} height={18} draggable={false} />
        <input
          className="grow"
          placeholder="하루 목표 추가 후 Enter"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={500}
          aria-label="하루 목표 내용"
        />
        <button
          type="button"
          className={detailed ? 'icon-only quick-add-more on' : 'icon-only quick-add-more'}
          onClick={() => setDetailed(!detailed)}
          aria-expanded={detailed}
          aria-label={detailed ? '간단히' : '자세히'}
          title={detailed ? '간단히' : '자세히 (분류)'}
        >
          <img src={moreIcon} alt="" aria-hidden="true" width={26} height={26} draggable={false} />
        </button>
        {(detailed || content) && (
          <button type="submit" className="quick-add-submit" aria-label="추가" title="추가 (Enter)">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />
            </svg>
          </button>
        )}
      </div>
      {/* 상세는 분류 색 칩만(1-4f ㉟·㊲·㊳). 다시 누르면 분류 없음. 첫 행동은 수정에서, 핵심은 ☆로 */}
      {detailed && (
        <div className="quick-add-detail category-chips" role="group" aria-label="분류">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={categoryId === c.id ? 'category-chip on' : 'category-chip'}
              aria-pressed={categoryId === c.id}
              onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
            >
              <span className="category-dot" style={{ background: c.color }} aria-hidden="true" />
              {c.name}
            </button>
          ))}
        </div>
      )}
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
