import { useEffect, useState } from 'react'
import type { Category } from '../../api/categories'
import { errorMessage } from '../../api/client'
import type { DailyGoal } from '../../api/dailyGoals'
import { formatDuration } from '../../api/focus'
import { carryOverWeeklyGoal, type Goal, type WeeklyGoal } from '../../api/goals'
import { saveWeeklyJournal, studySeconds, type WeeklyJournal } from '../../api/reviews'
import { DayColumn, WeekGoalList } from '../../components/plan/WeekParts'
import ReviewFields from '../../components/ReviewFields'
import { shiftDate, todaySeoul, weekDates, weekLabel } from '../../utils/date'
import { isoMonthOfWeek, monthlyGoalsOfWeek, plannedKey, weeklyGoalsOf, type Run } from './planData'

const STEPS = ['지난주 돌아보기', '못 끝낸 목표 정리', '이번 주 목표', '요일별 계획'] as const

type Props = {
  monday: string
  goals: Goal[]
  categories: Category[]
  dailyGoals: DailyGoal[]
  lastJournal: WeeklyJournal | null
  run: Run
  onClose: () => void
}

/** 주간 계획하기 4단계 안내(docs/design.md 1-4c, Sunsama의 주간 계획 흐름 참고) */
export default function WeeklyPlanningWizard({ monday, goals, categories, dailyGoals, lastJournal, run, onClose }: Props) {
  const [step, setStep] = useState(0)
  const lastMonday = shiftDate(monday, -7)
  const dates = weekDates(monday)
  const today = todaySeoul()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const finish = () => {
    try {
      localStorage.setItem(plannedKey(monday), '1')
    } catch {
      // 저장 못 해도 계획은 이미 서버에 있다
    }
    onClose()
  }

  const weeklyGoals = weeklyGoalsOf(goals, monday)

  return (
    <div className="wizard-backdrop" onClick={onClose}>
      <div className="card wizard" role="dialog" aria-label="주간 계획하기" onClick={(e) => e.stopPropagation()}>
        <div className="goal-header">
          <h2 className="goal-title">{weekLabel(monday)} 계획하기</h2>
          <button className="icon" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <ol className="wizard-steps">
          {STEPS.map((s, i) => (
            <li key={s} className={i === step ? 'active' : i < step ? 'passed' : ''}>
              <button className="ghost" onClick={() => setStep(i)}>
                {i + 1}. {s}
              </button>
            </li>
          ))}
        </ol>

        <div className="wizard-body">
          {step === 0 && <LastWeekStep lastMonday={lastMonday} journal={lastJournal} run={run} />}
          {step === 1 && <CarryOverStep lastGoals={weeklyGoalsOf(goals, lastMonday)} monday={monday} goals={goals} run={run} />}
          {step === 2 && (
            <>
              {lastJournal?.nextAction && (
                <p className="pinned-text card pinned">📌 지난주 "다음 주 반영": {lastJournal.nextAction}</p>
              )}
              <ul className="muted small month-context">
                {monthlyGoalsOfWeek(goals, monday).map((m) => (
                  <li key={m.id}>
                    {isoMonthOfWeek(monday).slice(5)}월 목표: {m.content} (주간 목표 {m.progress.achieved}/{m.progress.total} 달성)
                  </li>
                ))}
              </ul>
              <WeekGoalList
                monday={monday}
                weeklyGoals={weeklyGoals}
                monthlyGoals={monthlyGoalsOfWeek(goals, monday)}
                dailyGoals={dailyGoals}
                categories={categories}
                run={run}
              />
            </>
          )}
          {step === 3 && (
            <>
              <p className="muted small">요일마다 할 일을 적어요. 적은 것은 그날 할 일 목록에 바로 들어가요. 꼭 끝낼 일(핵심)은 그날 정해요.</p>
              <div className="week-grid">
                {dates.map((date) => (
                  <DayColumn
                    key={date}
                    date={date}
                    today={date === today}
                    dailyGoals={dailyGoals.filter((d) => d.date === date)}
                    weeklyGoals={weeklyGoals}
                    run={run}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="wizard-nav">
          <button className="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
            ‹ 이전
          </button>
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(step + 1)}>다음 ›</button>
          ) : (
            <button onClick={finish}>계획 끝내기 ✓</button>
          )}
        </div>
      </div>
    </div>
  )
}

function LastWeekStep({ lastMonday, journal, run }: { lastMonday: string; journal: WeeklyJournal | null; run: Run }) {
  if (!journal) return <p className="muted">불러오는 중…</p>
  const t = journal.total
  return (
    <>
      <p className="muted small">{weekLabel(lastMonday)}에 이렇게 보냈어요.</p>
      <dl className="result-stats log-stats">
        <dt>공부</dt>
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
      <p className="small">{journal.saved ? '지난주 일지예요. 고칠 것이 있으면 고쳐요.' : '지난주 일지가 아직 없어요. 짧게라도 남겨요.'}</p>
      <ReviewFields
        fields={[
          { key: 'good', label: '잘한 점', placeholder: '지난주에 잘된 것' },
          { key: 'bad', label: '아쉬운 점', placeholder: '막혔던 것' },
          { key: 'nextAction', label: '다음 주 반영', placeholder: '이번 주에 바꿀 한 가지' },
        ]}
        values={{ good: journal.good, bad: journal.bad, nextAction: journal.nextAction }}
        version={`${lastMonday}|${journal.updatedAt}`}
        aiSummary={journal.aiSummary}
        onSave={(v) => run(() => saveWeeklyJournal(lastMonday, { good: v.good, bad: v.bad, nextAction: v.nextAction }))}
      />
    </>
  )
}

type CarryProps = { lastGoals: WeeklyGoal[]; monday: string; goals: Goal[]; run: Run }

/** 지난주에 달성 못 한 주간 목표를 이어가거나 그대로 둔다 */
function CarryOverStep({ lastGoals, monday, goals, run }: CarryProps) {
  const pending = lastGoals.filter((w) => !w.achieved && !w.carriedOver)
  const [kept, setKept] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const targets = monthlyGoalsOfWeek(goals, monday)
  const [pickedId, setPickedId] = useState<number | null>(null)
  const targetId = targets.find((m) => m.id === pickedId)?.id ?? targets[0]?.id ?? null

  const carry = async (w: WeeklyGoal) => {
    setError(null)
    // 같은 달이면 원래 월간 목표에, 다른 달이면 이번 주 달의 월간 목표에 연결한다
    const sameMonth = targets.some((m) => m.id === w.monthlyGoalId)
    try {
      await run(() => carryOverWeeklyGoal(w.id, sameMonth ? null : targetId))
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const visible = pending.filter((w) => !kept.includes(w.id))
  const needsTarget = visible.some((w) => !targets.some((m) => m.id === w.monthlyGoalId))

  return (
    <>
      {error && <p className="error">{error}</p>}
      {visible.length === 0 ? (
        <p className="muted">정리할 목표가 없어요. 다음 단계로 가요.</p>
      ) : (
        <>
          <p className="muted small">지난주에 달성하지 못한 주간 목표예요. 이번 주에도 할지 정해요.</p>
          {needsTarget &&
            (targets.length > 0 ? (
              <p className="inline-form small">
                이번 주는 다른 달이라 이 월간 목표에 연결해요:
                <select value={targetId ?? ''} onChange={(e) => setPickedId(Number(e.target.value))}>
                  {targets.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.content}
                    </option>
                  ))}
                </select>
              </p>
            ) : (
              <p className="muted small">이번 주가 속한 달의 월간 목표가 없어 다른 달 목표는 이어갈 수 없어요.</p>
            ))}
          <ul className="unfinished-list">
            {visible.map((w) => (
              <li key={w.id}>
                <span>{w.content}</span>
                <span className="row-actions">
                  <button onClick={() => carry(w)}>이번 주로 이어가기</button>
                  <button className="ghost" onClick={() => setKept([...kept, w.id])}>
                    그대로 두기
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
