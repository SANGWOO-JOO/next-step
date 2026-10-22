import { useState } from 'react'
import type { Category } from '../api/categories'
import type { DailyGoal } from '../api/dailyGoals'
import type { Goal, MonthlyGoal, WeeklyGoal, WeeklyGoalInput } from '../api/goals'
import { addMonths, currentMonthSeoul, mondaysOfMonth, monthLabel, todaySeoul, weekDates } from '../utils/date'
import CategoryBadge from './CategoryBadge'
import DailyGoalPanel from './DailyGoalPanel'
import ProgressBar from './ProgressBar'
import WeeklyGoalForm from './WeeklyGoalForm'

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']

type Props = {
  goals: Goal[]
  categories: Category[]
  month: string
  onMonthChange: (month: string) => void
  onToggleMonthly: (monthly: MonthlyGoal) => void
  onToggleWeekly: (weekly: WeeklyGoal) => void
  onAddWeekly: (monthlyGoalId: number, input: WeeklyGoalInput) => Promise<boolean>
  /** 화면에 보이는 기간의 하루 목표 */
  dailyGoals: DailyGoal[]
  selectedDate: string | null
  onSelectDate: (date: string | null) => void
  run: (action: () => Promise<unknown>) => Promise<boolean>
}

/** 월 캘린더. 주(목요일 기준 소속) 한 줄마다 날짜 7칸과 그 주의 주간 목표를 보여준다. */
export default function GoalCalendar({
  goals,
  categories,
  month,
  onMonthChange,
  onToggleMonthly,
  onToggleWeekly,
  onAddWeekly,
  dailyGoals,
  selectedDate,
  onSelectDate,
  run,
}: Props) {
  const goalTitle = new Map(goals.map((g) => [g.id, g.title]))
  const monthlyGoals = goals.flatMap((g) => g.monthlyGoals).filter((m) => m.month === month)
  const today = todaySeoul()

  return (
    <div className="card">
      <div className="calendar-nav">
        <button className="icon" onClick={() => onMonthChange(addMonths(month, -1))} aria-label="이전 달">
          ◀
        </button>
        <h2>{monthLabel(month)}</h2>
        <button className="icon" onClick={() => onMonthChange(addMonths(month, 1))} aria-label="다음 달">
          ▶
        </button>
        {month !== currentMonthSeoul() && (
          <button className="ghost" onClick={() => onMonthChange(currentMonthSeoul())}>
            이번 달
          </button>
        )}
      </div>

      {monthlyGoals.length === 0 ? (
        <p className="muted small">이 달의 월간 목표가 없어요. 트리 보기에서 먼저 추가하면 주간 목표를 넣을 수 있어요.</p>
      ) : (
        <ul className="calendar-monthly">
          {monthlyGoals.map((m) => (
            <li key={m.id}>
              <input type="checkbox" checked={m.achieved} onChange={() => onToggleMonthly(m)} aria-label="달성" />
              <span className={m.achieved ? 'done' : undefined}>{m.content}</span>
              <span className="muted small">{goalTitle.get(m.goalId)}</span>
              <ProgressBar progress={m.progress} />
            </li>
          ))}
        </ul>
      )}

      <div className="calendar">
        <div className="calendar-row calendar-head muted small">
          <div className="calendar-days">
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <span>주간 목표</span>
        </div>
        {mondaysOfMonth(month).map((monday) => (
          <WeekRow
            key={monday}
            monday={monday}
            month={month}
            today={today}
            monthlyGoals={monthlyGoals}
            categories={categories}
            onToggleWeekly={onToggleWeekly}
            onAddWeekly={onAddWeekly}
            dailyGoals={dailyGoals}
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
            run={run}
          />
        ))}
      </div>
    </div>
  )
}

type WeekRowProps = {
  monday: string
  month: string
  today: string
  monthlyGoals: MonthlyGoal[]
  categories: Category[]
  onToggleWeekly: (weekly: WeeklyGoal) => void
  onAddWeekly: (monthlyGoalId: number, input: WeeklyGoalInput) => Promise<boolean>
  dailyGoals: DailyGoal[]
  selectedDate: string | null
  onSelectDate: (date: string | null) => void
  run: (action: () => Promise<unknown>) => Promise<boolean>
}

function WeekRow({
  monday,
  month,
  today,
  monthlyGoals,
  categories,
  onToggleWeekly,
  onAddWeekly,
  dailyGoals,
  selectedDate,
  onSelectDate,
  run,
}: WeekRowProps) {
  const [adding, setAdding] = useState(false)
  const [pickedId, setPickedId] = useState<number | null>(null)
  // 고른 월간 목표가 없거나 사라졌으면 첫 번째 월간 목표에 연결한다
  const monthlyGoalId = monthlyGoals.find((m) => m.id === pickedId)?.id ?? monthlyGoals[0]?.id
  const weeklyGoals = monthlyGoals.flatMap((m) => m.weeklyGoals).filter((w) => w.weekStart === monday)
  const dates = weekDates(monday)
  const currentWeek = dates.includes(today)
  const selectedInWeek = selectedDate !== null && dates.includes(selectedDate)

  return (
    <>
      <div className={currentWeek ? 'calendar-row current' : 'calendar-row'}>
        <div className="calendar-days">
          {dates.map((date) => {
            const goalsOfDay = dailyGoals.filter((d) => d.date === date)
            const classes = ['calendar-day']
            if (!date.startsWith(month)) classes.push('outside')
            if (date === today) classes.push('today')
            if (date === selectedDate) classes.push('selected')
            return (
              <button
                key={date}
                type="button"
                className={classes.join(' ')}
                onClick={() => onSelectDate(date === selectedDate ? null : date)}
                aria-label={`${date} 하루 목표 ${goalsOfDay.length}개`}
                aria-pressed={date === selectedDate}
              >
                <span className="calendar-date">{Number(date.slice(8, 10))}</span>
                <span className="calendar-dots">
                  {goalsOfDay.slice(0, 4).map((d) => (
                    <span
                      key={d.id}
                      className={d.status === 'DONE' ? 'dot done' : 'dot'}
                      style={{ borderColor: d.category?.color, background: d.status === 'DONE' ? d.category?.color : undefined }}
                    />
                  ))}
                  {goalsOfDay.length > 4 && <span className="dot-more">+{goalsOfDay.length - 4}</span>}
                </span>
              </button>
            )
          })}
        </div>

        <div className="calendar-goals">
          {weeklyGoals.map((w) => (
            <div key={w.id} className="calendar-goal">
              <input type="checkbox" checked={w.achieved} onChange={() => onToggleWeekly(w)} aria-label="달성" />
              <span className={w.achieved ? 'done' : undefined}>{w.content}</span>
              {w.category && <CategoryBadge name={w.category.name} color={w.category.color} inactive={!w.category.active} />}
            </div>
          ))}

          {adding && monthlyGoalId !== undefined ? (
            <div className="calendar-add">
              {monthlyGoals.length > 1 && (
                <select
                  value={monthlyGoalId}
                  onChange={(e) => setPickedId(Number(e.target.value))}
                  aria-label="연결할 월간 목표"
                >
                  {monthlyGoals.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.content}
                    </option>
                  ))}
                </select>
              )}
              <WeeklyGoalForm
                month={month}
                categories={categories}
                defaultWeekStart={monday}
                showWeek={false}
                submitLabel="추가"
                onSubmit={(input) => onAddWeekly(monthlyGoalId, input).then((ok) => ok && setAdding(false))}
                onCancel={() => setAdding(false)}
              />
            </div>
          ) : (
            monthlyGoals.length > 0 && (
              <button className="ghost add" onClick={() => setAdding(true)}>
                + 주간 목표
              </button>
            )
          )}
        </div>
      </div>
      {selectedInWeek && (
        <DailyGoalPanel
          key={selectedDate}
          date={selectedDate}
          goals={dailyGoals.filter((d) => d.date === selectedDate)}
          weeklyGoals={weeklyGoals}
          categories={categories}
          run={run}
          onClose={() => onSelectDate(null)}
        />
      )}
    </>
  )
}
