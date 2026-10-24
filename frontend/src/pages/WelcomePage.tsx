import { useEffect, useRef, useState } from 'react'
import { errorMessage } from '../api/client'
import { completeOnboarding, skipOnboarding, type Me, type Purpose } from '../api/me'
import { availableColors } from '../utils/categoryColors'
import { addMonths, mondayOf, seoulIso, shiftDate, todaySeoul } from '../utils/date'

/** 목적 카드(docs/design.md 11-1) */
const PURPOSES: { id: Purpose; title: string; desc: string; goals: string[] }[] = [
  {
    id: 'JOB_SEEKER',
    title: '취업 준비생',
    desc: '첫 취업 준비 중 · 코테·면접·자격증',
    goals: ['코딩 테스트 합격', '기술 면접 준비', '정보처리기사', '포트폴리오 완성'],
  },
  {
    id: 'CAREER_CHANGER',
    title: '이직 준비 중',
    desc: '회사 다니면서, 또는 퇴직 후 · 이력서·면접',
    goals: ['이력서·경력기술서 정리', '모의 면접 10번', '코딩 테스트 감 되찾기', '포트폴리오 업데이트', '자격증 하나 따기'],
  },
]

const DEADLINES: { id: string; label: string; months: number | null }[] = [
  { id: '1m', label: '한 달 뒤', months: 1 },
  { id: '3m', label: '3개월 뒤', months: 3 },
  { id: '6m', label: '6개월 뒤', months: 6 },
  { id: 'none', label: '정하지 않음', months: null },
]

const DAYS = ['월', '화', '수', '목', '금', '토', '일']
const HOURS = Array.from({ length: 16 }, (_, i) => 7 + i) // 7~22시
const WEEKDAYS = [0, 1, 2, 3, 4]

/** 목적별 기본 칸(docs/design.md 11-3): 요일 번호(월=0) × 시 */
const PRESETS: Record<Purpose, [number[], number[]][]> = {
  JOB_SEEKER: [
    [WEEKDAYS, [9, 10, 11]],
    [WEEKDAYS, [20]],
  ],
  CAREER_CHANGER: [
    [WEEKDAYS, [20]],
    [[5], [10, 11]],
  ],
}

const key = (day: number, hour: number) => `${day}-${hour}`

/** 그 날짜 문자열에 개월을 더한다(말일은 그 달 말일로) */
function plusMonths(date: string, months: number) {
  const month = addMonths(date.slice(0, 7), months)
  const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
  return `${month}-${String(Math.min(Number(date.slice(8)), lastDay)).padStart(2, '0')}`
}

/**
 * 시작 설정(docs/design.md 11-3, 11-6 2-3): 목적 → 첫 목표 → 이번 주 공부 시간 칠하기.
 * 마지막에 한 번에 저장한다. 칠한 칸은 오늘 이후의 이번 주 블록이 된다(지난 요일은 칠할 수 없음).
 */
export default function WelcomePage({ me, onDone }: { me: Me; onDone: (me: Me) => void }) {
  const today = todaySeoul()
  const monday = mondayOf(today)
  // 오늘 요일 번호(월=0). 이보다 앞 요일은 칠할 수 없다
  const todayIndex = Math.round((Date.parse(today) - Date.parse(monday)) / 86_400_000)

  const [step, setStep] = useState(1)
  const [purpose, setPurpose] = useState<Purpose>('JOB_SEEKER')
  const [goalName, setGoalName] = useState(PURPOSES[0].goals[0])
  const [own, setOwn] = useState('')
  const [deadline, setDeadline] = useState('3m')
  const [cells, setCells] = useState<Set<string>>(() => presetCells('JOB_SEEKER', todayIndex))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const painting = useRef<boolean | null>(null)

  useEffect(() => {
    const stop = () => (painting.current = null)
    window.addEventListener('pointerup', stop)
    return () => window.removeEventListener('pointerup', stop)
  }, [])

  const P = PURPOSES.find((p) => p.id === purpose)!
  const title = own.trim() || goalName
  const hours = cells.size

  const pickPurpose = (id: Purpose) => {
    setPurpose(id)
    setGoalName(PURPOSES.find((p) => p.id === id)!.goals[0])
    setOwn('')
    setCells(presetCells(id, todayIndex))
  }

  const paint = (k: string, on: boolean) =>
    setCells((prev) => {
      const next = new Set(prev)
      if (on) next.add(k)
      else next.delete(k)
      return next
    })

  /** 요일마다 이어진 칸을 합쳐 블록으로 */
  const blocks = () =>
    DAYS.flatMap((_, d) => {
      const date = shiftDate(monday, d)
      const on = HOURS.filter((h) => cells.has(key(d, h)))
      const runs: [number, number][] = []
      on.forEach((h) => {
        const last = runs[runs.length - 1]
        if (last && last[1] === h) last[1] = h + 1
        else runs.push([h, h + 1])
      })
      return runs.map(([s, e]) => ({ startAt: seoulIso(date, s * 60), endAt: seoulIso(date, e * 60) }))
    })

  const finish = async (withBlocks: boolean) => {
    setBusy(true)
    setError(null)
    try {
      const months = DEADLINES.find((d) => d.id === deadline)!.months
      const me = await completeOnboarding({
        purpose,
        goal: { title, color: availableColors([])[0], targetDate: months === null ? null : plusMonths(today, months) },
        blocks: withBlocks ? blocks() : [],
      })
      onDone(me)
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  const skip = async () => {
    setBusy(true)
    try {
      onDone(await skipOnboarding())
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  const name = me.name ?? '성장러'

  return (
    <main className="welcome">
      <div className="welcome-card">
        <div className="welcome-top">
          <span className="welcome-steps" aria-label={`${step} / 3단계`}>
            {[1, 2, 3].map((n) => (
              <span key={n} className={n <= step ? 'welcome-step on' : 'welcome-step'} />
            ))}
          </span>
          <button type="button" className="ghost small" onClick={skip} disabled={busy}>
            이미 쓰고 있어요, 건너뛰기
          </button>
        </div>

        {step === 1 && (
          <section>
            <h1 className="welcome-title">반가워요, {name}님</h1>
            <p className="welcome-lead">요즘 어떤 시간을 보내고 있나요? 상황에 맞춰 목표 예시와 공부 시간을 골라 둘게요.</p>
            <div className="welcome-purposes">
              {PURPOSES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={p.id === purpose ? 'welcome-purpose on' : 'welcome-purpose'}
                  aria-pressed={p.id === purpose}
                  onClick={() => pickPurpose(p.id)}
                >
                  <strong>{p.title}</strong>
                  <span className="muted small">{p.desc}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <h1 className="welcome-title">먼저 목표 하나만 정해 볼까요?</h1>
            <p className="welcome-lead">지금 가장 하고 싶은 것 하나요. 쓰다가 언제든 바꾸거나 더할 수 있어요.</p>
            <div className="welcome-chips">
              {P.goals.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={!own.trim() && goalName === g ? 'welcome-chip on' : 'welcome-chip'}
                  onClick={() => {
                    setGoalName(g)
                    setOwn('')
                  }}
                >
                  {g}
                </button>
              ))}
            </div>
            <label className="welcome-label">
              목록에 없으면 직접 써도 돼요
              <input value={own} onChange={(e) => setOwn(e.target.value)} placeholder="예: 토익 스피킹 IH" maxLength={50} />
            </label>
            <p className="welcome-label">
              언제까지? <span className="muted">몰라도 괜찮아요</span>
            </p>
            <div className="welcome-chips">
              {DEADLINES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={deadline === d.id ? 'welcome-chip on' : 'welcome-chip'}
                  onClick={() => setDeadline(d.id)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 3 && (
          <section>
            <h1 className="welcome-title">이번 주에 언제 시간이 나요?</h1>
            <p className="welcome-lead">
              칠한 칸이 이번 주 &lsquo;{title}&rsquo; 일정이 돼요. 시작한 뒤에 끌어서 옮길 수 있어요.
            </p>
            <div className="welcome-grid-head">
              <span className="muted small">칸을 누르거나 끌어서 칠하고 지워요 · 일주일에 {hours}시간</span>
              <button type="button" className="ghost small" onClick={() => setCells(new Set())}>
                다 지우기
              </button>
            </div>
            <div className="welcome-grid" role="grid" aria-label="이번 주 공부 시간" onPointerLeave={() => (painting.current = null)}>
              <span />
              {DAYS.map((d, i) => (
                <span key={d} className={i < todayIndex ? 'welcome-day past' : 'welcome-day'}>
                  {d}
                </span>
              ))}
              {HOURS.map((h) => (
                <Row key={h} hour={h}>
                  {DAYS.map((d, i) => {
                    const k = key(i, h)
                    const on = cells.has(k)
                    const past = i < todayIndex
                    return (
                      <button
                        key={k}
                        type="button"
                        className={past ? 'welcome-cell past' : on ? 'welcome-cell on' : 'welcome-cell'}
                        disabled={past}
                        aria-pressed={on}
                        aria-label={`${d}요일 ${h}시`}
                        title={past ? '지난 요일은 칠할 수 없어요' : undefined}
                        onPointerDown={(e) => {
                          e.preventDefault()
                          painting.current = !on
                          paint(k, !on)
                        }}
                        onPointerEnter={() => painting.current !== null && paint(k, painting.current)}
                      />
                    )
                  })}
                </Row>
              ))}
            </div>
          </section>
        )}

        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}

        <div className="welcome-foot">
          {step > 1 && (
            <button type="button" className="ghost" onClick={() => setStep(step - 1)} disabled={busy}>
              이전
            </button>
          )}
          <span className="welcome-foot-right">
            {step === 3 && (
              <button type="button" className="ghost" onClick={() => finish(false)} disabled={busy}>
                빈 시간표로 시작할게요
              </button>
            )}
            {step < 3 ? (
              <button type="button" onClick={() => setStep(step + 1)} disabled={step === 2 && !title.trim()}>
                다음
              </button>
            ) : (
              <button type="button" onClick={() => finish(true)} disabled={busy}>
                이대로 시작하기
              </button>
            )}
          </span>
        </div>
      </div>
    </main>
  )
}

/** 표 한 줄: 시각 이름 + 요일 칸 7개 */
function Row({ hour, children }: { hour: number; children: React.ReactNode }) {
  return (
    <>
      <span className="welcome-hour">{hour}시</span>
      {children}
    </>
  )
}

/** 목적별 기본 칸. 지난 요일은 뺀다 */
function presetCells(purpose: Purpose, todayIndex: number) {
  const set = new Set<string>()
  PRESETS[purpose].forEach(([days, hours]) =>
    days.filter((d) => d >= todayIndex).forEach((d) => hours.forEach((h) => set.add(key(d, h)))),
  )
  return set
}
