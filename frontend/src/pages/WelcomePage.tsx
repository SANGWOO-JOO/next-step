import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { completeOnboarding, skipOnboarding, type Me, type Purpose } from '../api/me'
import studentArt from '../assets/illust/mascot-student.svg'
import workerArt from '../assets/illust/mascot-worker.svg'
import { availableColors } from '../utils/categoryColors'
import { addMonths, mondayOf, seoulIso, shiftDate, todaySeoul } from '../utils/date'

/** 목적 카드(docs/design.md 11-1) */
const PURPOSES: { id: Purpose; title: string; desc: string; goals: string[] }[] = [
  {
    id: 'JOB_SEEKER',
    title: '취업 준비생',
    desc: '첫 회사를 찾는 중',
    goals: ['코딩 테스트 합격', '기술 면접 준비', '정보처리기사', '포트폴리오 완성'],
  },
  {
    id: 'CAREER_CHANGER',
    title: '이직 준비 중',
    desc: '다른 회사로 옮기려는 중',
    goals: ['이력서와 경력기술서 정리', '면접 준비', '코딩 테스트 준비'],
  },
]

/** 목적 카드의 스텝이(손에 든 이력서·노트북이 상황을 말해 준다) */
const ART: Record<Purpose, { mascot: string }> = {
  JOB_SEEKER: { mascot: studentArt },
  CAREER_CHANGER: { mascot: workerArt },
}

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
 * 시작 설정(docs/design.md 11-3, 11-6 2-3): 목적 → 첫 목표 → 한 주 공부 시간 칠하기.
 * 마지막에 한 번에 저장한다. 칠하는 주는 이번 주, 오늘 이후 요일만(2-3 ③).
 */
export default function WelcomePage({ me, onDone }: { me: Me; onDone: (me: Me) => void }) {
  const navigate = useNavigate()
  const today = todaySeoul()
  const monday = mondayOf(today)
  // 오늘 요일 번호(월=0). 이보다 앞 요일은 칠할 수 없다
  const firstDay = Math.round((Date.parse(today) - Date.parse(monday)) / 86_400_000)
  // 금·토·일에 시작하면 남은 날이 적다고 알려 준다
  const fewDaysLeft = firstDay >= 4

  const [step, setStep] = useState(1)
  const [purpose, setPurpose] = useState<Purpose>('JOB_SEEKER')
  const [goalName, setGoalName] = useState(PURPOSES[0].goals[0])
  const [own, setOwn] = useState('')
  const [deadline, setDeadline] = useState('3m')
  const [cells, setCells] = useState<Set<string>>(() => presetCells('JOB_SEEKER', firstDay))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const painting = useRef<boolean | null>(null)
  // 끄는 동안 마우스 아이콘을 처음 누른 동작(칠하기·지우기)으로 고정한다
  const [dragMode, setDragMode] = useState<'paint' | 'erase' | null>(null)

  useEffect(() => {
    const stop = () => {
      painting.current = null
      setDragMode(null)
    }
    window.addEventListener('pointerup', stop)
    return () => window.removeEventListener('pointerup', stop)
  }, [])

  const P = PURPOSES.find((p) => p.id === purpose)!
  const title = own.trim() || goalName
  // 요일별 칠한 시간과 그중 가장 많은 날(막대 길이 기준)
  const dayHours = DAYS.map((_, i) => (i < firstDay ? 0 : HOURS.filter((h) => cells.has(key(i, h))).length))
  const maxDayHours = Math.max(1, ...dayHours)
  // 칠할 수 있는 칸만 센다
  const hours = [...cells].filter((k) => Number(k.split('-')[0]) >= firstDay).length

  const pickPurpose = (id: Purpose) => {
    setPurpose(id)
    setGoalName(PURPOSES.find((p) => p.id === id)!.goals[0])
    setOwn('')
    setCells(presetCells(id, firstDay))
  }

  // 지난 요일 칸은 끌면서 지나가도 칠하지 않는다
  const paint = (k: string, on: boolean) =>
    Number(k.split('-')[0]) >= firstDay &&
    setCells((prev) => {
      const next = new Set(prev)
      if (on) next.add(k)
      else next.delete(k)
      return next
    })

  /** 요일마다 이어진 칸을 합쳐 블록으로 */
  const blocks = () =>
    DAYS.flatMap((_, d) => {
      if (d < firstDay) return []
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
      // 칠한 주를 일정 화면에서 바로 보이게
      navigate(`/?date=${monday}`, { replace: true })
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
            건너뛰기
          </button>
        </div>

        {step === 1 && (
          <section>
            <h1 className="welcome-title">{name}님, 지금 어떤 준비 중이에요?</h1>
            <p className="welcome-lead">고른 쪽에 맞는 목표 예시를 보여 줘요.</p>
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
                  {/* 스텝이가 오른쪽 아래에서 빼꼼(2-3 A안). 장식이라 읽지 않는다 */}
                  <img className="welcome-mascot" src={ART[p.id].mascot} alt="" aria-hidden="true" draggable={false} />
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <h1 className="welcome-title">첫 목표를 정해요</h1>
            <p className="welcome-lead">목표는 나중에 바꾸거나 더할 수 있어요.</p>
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
              직접 쓰기
              <input value={own} onChange={(e) => setOwn(e.target.value)} placeholder="예: 토익 스피킹 IH" maxLength={50} />
            </label>
            <p className="welcome-label welcome-label-inline">
              기한
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
            <h1 className="welcome-title">이번 주에 공부할 시간을 칠해요</h1>
            <p className="welcome-lead">
              {Number(monday.slice(5, 7))}월 {Number(monday.slice(8))}일부터 {Number(shiftDate(monday, 6).slice(5, 7))}월{' '}
              {Number(shiftDate(monday, 6).slice(8))}일까지. 칠한 칸은 &lsquo;{title}&rsquo; 일정이 돼요.
            </p>
            {fewDaysLeft && <p className="welcome-note">이번 주는 {7 - firstDay}일 남았어요. 다음 주 시간은 일정에서 잡으면 돼요.</p>}
            {/* 합계는 글자로, 요일별 양은 표 아래 같은 열에(2-3, 사용자 확인 B안) */}
            <div className="welcome-grid-head">
              {hours === 0 ? (
                <span className="welcome-total empty">칸을 누르거나 끌어서 칠해요</span>
              ) : (
                <span className="welcome-total">
                  일주일 <strong key={hours}>{hours}시간</strong>
                </span>
              )}
              <button type="button" className="ghost small welcome-clear" onClick={() => setCells(new Set())} disabled={hours === 0}>
                다 지우기
              </button>
            </div>
            <div
              className={dragMode ? `welcome-grid ${dragMode}ing` : 'welcome-grid'}
              role="grid"
              aria-label="한 주 공부 시간"
              onPointerLeave={() => {
                painting.current = null
                setDragMode(null)
              }}
            >
              <span />
              {DAYS.map((d, i) => (
                <span key={d} className={i < firstDay ? 'welcome-day past' : 'welcome-day'}>
                  {d} <span className="welcome-date">{Number(shiftDate(monday, i).slice(8))}</span>
                  {i < firstDay && <span className="welcome-past-tag">지남</span>}
                </span>
              ))}
              {HOURS.map((h) => (
                <Row key={h} hour={h}>
                  {DAYS.map((d, i) => {
                    const k = key(i, h)
                    const on = cells.has(k)
                    const past = i < firstDay
                    return (
                      <button
                        key={k}
                        type="button"
                        className={past ? 'welcome-cell past' : on ? 'welcome-cell on' : 'welcome-cell'}
                        disabled={past}
                        aria-pressed={on}
                        aria-label={`${d}요일 ${h}시`}
                        onPointerDown={(e) => {
                          e.preventDefault()
                          painting.current = !on
                          setDragMode(on ? 'erase' : 'paint')
                          paint(k, !on)
                        }}
                        onPointerEnter={() => painting.current !== null && paint(k, painting.current)}
                      />
                    )
                  })}
                </Row>
              ))}
              <span />
              {DAYS.map((d, i) => {
                const n = dayHours[i]
                return (
                  <span key={d} className={i < firstDay ? 'welcome-daysum past' : 'welcome-daysum'} aria-label={`${d}요일 ${n}시간`}>
                    <span className="welcome-daybar">
                      {/* 그 주에 가장 많이 칠한 날을 가득 찬 막대로 */}
                      <span style={{ width: `${(n / maxDayHours) * 100}%` }} />
                    </span>
                    {i >= firstDay && <span className={n ? 'welcome-dayhours' : 'welcome-dayhours zero'}>{n}시간</span>}
                  </span>
                )
              })}
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
                칠하지 않고 시작
              </button>
            )}
            {step < 3 ? (
              <button type="button" onClick={() => setStep(step + 1)} disabled={step === 2 && !title.trim()}>
                다음
              </button>
            ) : (
              <button type="button" onClick={() => finish(true)} disabled={busy}>
                시작하기
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

/** 목적별 기본 칸. 칠할 수 없는 요일은 뺀다 */
function presetCells(purpose: Purpose, firstDay: number) {
  const set = new Set<string>()
  PRESETS[purpose].forEach(([days, hours]) =>
    days.filter((d) => d >= firstDay).forEach((d) => hours.forEach((h) => set.add(key(d, h)))),
  )
  return set
}
