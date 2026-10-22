import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getCategories, type Category } from '../api/categories'
import { errorMessage } from '../api/client'
import { getDailyGoals, type DailyGoal } from '../api/dailyGoals'
import {
  addDistractionNote,
  changeFocusCategory,
  checkDistractionNote,
  DEFAULT_BREAK_MINUTES,
  DEFAULT_FOCUS_MINUTES,
  endFocus,
  endInterruption,
  formatClock,
  formatDuration,
  getCurrentFocus,
  getDistractionNotes,
  INTERRUPTION_LABELS,
  openInterruptionOf,
  RESULT_LABELS,
  startFocus,
  startInterruption,
  type DistractionNote,
  type FocusResult,
  type FocusSession,
  type InterruptionType,
} from '../api/focus'
import CategoryBadge from '../components/CategoryBadge'
import { todaySeoul } from '../utils/date'

/** 탭을 이만큼 이상 벗어나야 중단으로 기록한다 */
const TAB_AWAY_THRESHOLD_MS = 30_000

/** 1초마다 바뀌는 현재 시각(ms) */
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

export default function FocusPage() {
  const [session, setSession] = useState<FocusSession | null>(null)
  /** 서버 응답을 받은 시각. 진행 중 집중 시간은 서버 값 + 그 뒤로 흐른 시간 */
  const [fetchedAt, setFetchedAt] = useState(() => Date.now())
  const [finished, setFinished] = useState<FocusSession | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)
  /** 탭 이탈로 기록한 중단의 돌아온 시각 */
  const [returnedAt, setReturnedAt] = useState<string | null>(null)
  /** 집중 중에는 위쪽 메뉴를 숨겨 타이머만 보이게 한다 */
  const [immersive, setImmersive] = useState(true)
  const hideMenu = !!session && immersive

  useEffect(() => {
    document.body.classList.toggle('immersive', hideMenu)
    return () => document.body.classList.remove('immersive')
  }, [hideMenu])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined)
    else document.documentElement.requestFullscreen().catch(() => undefined)
  }

  const apply = useCallback((s: FocusSession | null | undefined) => {
    setSession(s ?? null)
    setFetchedAt(Date.now())
  }, [])

  useEffect(() => {
    Promise.all([getCurrentFocus(), getCategories()])
      .then(([s, c]) => {
        apply(s)
        setCategories(c)
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoaded(true))
  }, [apply])

  const run = async (action: () => Promise<FocusSession | null | undefined | void>) => {
    setError(null)
    try {
      const s = await action()
      if (s !== undefined) apply(s)
      return true
    } catch (e) {
      setError(errorMessage(e))
      // 다른 탭에서 바뀌었을 수 있으니 서버 상태로 맞춘다
      getCurrentFocus().then(apply).catch(() => undefined)
      return false
    }
  }

  useTabAway(session, async (hiddenAt, backAt) => {
    if (!session) return
    const ok = await run(() => startInterruption(session.id, 'TAB_HIDDEN', hiddenAt))
    if (ok) setReturnedAt(backAt)
  })

  const end = async (result: FocusResult) => {
    if (!session) return
    try {
      setError(null)
      const ended = await endFocus(session.id, result)
      setFinished(ended)
      apply(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <section className="focus-page">
      <div className="focus-head">
        <h1>집중 모드</h1>
        {session && (
          <span className="row-actions">
            <button className="ghost" onClick={() => setImmersive(!immersive)}>
              {immersive ? '☰ 메뉴 보기' : '메뉴 숨기기'}
            </button>
            <button className="ghost" onClick={toggleFullscreen}>
              ⛶ 전체 화면
            </button>
          </span>
        )}
      </div>
      {error && (
        <p className="error-banner" role="alert">
          {error}
          <button className="icon" onClick={() => setError(null)} aria-label="닫기">
            ×
          </button>
        </p>
      )}
      {!loaded ? (
        <p className="muted">불러오는 중…</p>
      ) : session ? (
        <RunningSession
          session={session}
          fetchedAt={fetchedAt}
          categories={categories}
          returnedAt={returnedAt}
          run={run}
          onEnd={end}
          onInterruptionEnded={() => setReturnedAt(null)}
        />
      ) : finished ? (
        <ResultCard
          session={finished}
          onAgain={() =>
            run(() =>
              startFocus({
                dailyGoalId: finished.dailyGoal?.status === 'DONE' ? null : (finished.dailyGoal?.id ?? null),
                categoryId: finished.category?.id ?? null,
                focusMinutes: finished.focusMinutes,
                breakMinutes: finished.breakMinutes,
                source: 'FOCUS_PAGE',
              }),
            ).then((ok) => ok && setFinished(null))
          }
          onClose={() => setFinished(null)}
        />
      ) : (
        <>
          <StartForm categories={categories} run={run} />
          <NoteInbox />
        </>
      )}
    </section>
  )
}

/** 탭을 30초 이상 벗어났다가 돌아오면 onAway(벗어난 시각, 돌아온 시각)를 부른다. 이미 중단 중이면 무시한다. */
function useTabAway(session: FocusSession | null, onAway: (hiddenAt: string, backAt: string) => void) {
  const hiddenAt = useRef<number | null>(null)
  const latest = useRef({ session, onAway })
  useEffect(() => {
    latest.current = { session, onAway }
  })

  useEffect(() => {
    const onChange = () => {
      const { session: s, onAway: callback } = latest.current
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now()
        return
      }
      const from = hiddenAt.current
      hiddenAt.current = null
      if (from === null || !s || openInterruptionOf(s)) return
      // 세션 시작 전에 숨긴 경우는 시작 시각부터 센다
      const start = Math.max(from, new Date(s.startedAt).getTime())
      if (Date.now() - start >= TAB_AWAY_THRESHOLD_MS) {
        callback(new Date(start).toISOString(), new Date().toISOString())
      }
    }
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])
}

type Run = (action: () => Promise<FocusSession | null | undefined | void>) => Promise<boolean>

type RunningProps = {
  session: FocusSession
  fetchedAt: number
  categories: Category[]
  returnedAt: string | null
  run: Run
  onEnd: (result: FocusResult) => void
  onInterruptionEnded: () => void
}

function RunningSession({ session, fetchedAt, categories, returnedAt, run, onEnd, onInterruptionEnded }: RunningProps) {
  const now = useNow()
  const open = openInterruptionOf(session)
  const focusSeconds = session.focusSeconds + (open ? 0 : Math.max(0, (now - fetchedAt) / 1000))
  const remaining = session.focusMinutes * 60 - focusSeconds
  const [ending, setEnding] = useState(false)
  const showResult = ending || remaining <= 0

  useEffect(() => {
    const previous = document.title
    document.title = `${open ? '⏸' : '▶'} ${formatClock(Math.abs(remaining))} · 집중`
    return () => {
      document.title = previous
    }
  })

  const choosable = categories.some((c) => c.id === session.category?.id)
    ? categories
    : [...(session.category ? [{ ...session.category, name: `${session.category.name} (비활성)` }] : []), ...categories]

  return (
    <div className="focus-layout">
      <div className={open ? 'card focus-main paused' : 'card focus-main'}>
        <div className="focus-goal">
          {session.dailyGoal ? (
            <>
              <strong className="focus-goal-title">{session.dailyGoal.content}</strong>
              {session.dailyGoal.firstAction && (
                <span className="muted">첫 행동: {session.dailyGoal.firstAction}</span>
              )}
            </>
          ) : (
            <strong className="focus-goal-title">분류만으로 집중 중</strong>
          )}
          <label className="small muted">
            분류{' '}
            <select
              value={session.category?.id ?? ''}
              onChange={(e) =>
                run(() => changeFocusCategory(session.id, e.target.value ? Number(e.target.value) : null))
              }
              aria-label="분류 변경"
            >
              <option value="">미분류</option>
              {choosable.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={remaining < 0 ? 'focus-timer over' : 'focus-timer'} aria-live="off">
          {remaining < 0 ? `+${formatClock(-remaining)}` : formatClock(remaining)}
        </div>
        <p className="muted small focus-sub">
          {open ? '일시정지 · ' : ''}집중 {formatDuration(focusSeconds)} / {session.focusMinutes}분 · 휴식{' '}
          {session.breakMinutes}분 예정
        </p>

        {open ? (
          <InterruptionForm
            key={open.id}
            session={session}
            returnedAt={open.detection === 'TAB_HIDDEN' ? returnedAt : null}
            run={run}
            onDone={onInterruptionEnded}
          />
        ) : showResult ? (
          <div className="focus-actions">
            <span className="muted">{remaining <= 0 ? '시간이 다 됐어요. 어땠나요?' : '어떻게 끝낼까요?'}</span>
            {(['COMPLETED', 'MORE', 'DISTRACTED'] as const).map((r) => (
              <button key={r} className={r === 'COMPLETED' ? '' : 'ghost'} onClick={() => onEnd(r)}>
                {RESULT_LABELS[r]}
              </button>
            ))}
            {ending && remaining > 0 && (
              <button className="icon" onClick={() => setEnding(false)}>
                계속하기
              </button>
            )}
          </div>
        ) : (
          <div className="focus-actions">
            <button className="danger" onClick={() => run(() => startInterruption(session.id, 'BUTTON'))}>
              딴짓했어요
            </button>
            <button className="ghost" onClick={() => setEnding(true)}>
              끝내기
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <NoteForm session={session} run={run} />
      </div>
    </div>
  )
}

type InterruptionFormProps = { session: FocusSession; returnedAt: string | null; run: Run; onDone: () => void }

/** 열린 중단을 끝내며 종류를 고른다. 탭 이탈이면 돌아온 시각으로 끝낸다. */
function InterruptionForm({ session, returnedAt, run, onDone }: InterruptionFormProps) {
  const open = openInterruptionOf(session)!
  const [memo, setMemo] = useState('')
  const now = useNow()
  const until = returnedAt ? new Date(returnedAt).getTime() : now
  const away = (until - new Date(open.startedAt).getTime()) / 1000

  const finish = (type: InterruptionType) =>
    run(() =>
      endInterruption(session.id, open.id, { type, memo: memo.trim() || null, endedAt: returnedAt ?? undefined }),
    ).then((ok) => ok && onDone())

  return (
    <div className="interruption-box">
      <p className="interruption-title">
        {open.detection === 'TAB_HIDDEN'
          ? `탭을 ${formatDuration(away)} 벗어났어요. 무엇을 했나요?`
          : `중단 중 · ${formatDuration(away)}`}
      </p>
      <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모 (선택)" maxLength={500} />
      <div className="focus-actions">
        <span className="muted small">돌아왔어요:</span>
        {(['DISTRACTION', 'STUDY_MATERIAL', 'BREAK'] as const).map((t) => (
          <button key={t} className={t === 'STUDY_MATERIAL' ? '' : 'ghost'} onClick={() => finish(t)}>
            {INTERRUPTION_LABELS[t]}
          </button>
        ))}
      </div>
      <p className="muted small">공부 자료 찾기는 집중 시간에 포함되고, 딴짓·휴식은 빠져요.</p>
    </div>
  )
}

/** 집중 중 떠오른 딴생각을 적어 두고 나중에 확인한다. */
function NoteForm({ session, run }: { session: FocusSession; run: Run }) {
  const [content, setContent] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const text = content.trim()
    if (!text) return
    run(async () => {
      await addDistractionNote(session.id, text)
      setContent('')
      return getCurrentFocus()
    })
  }

  return (
    <>
      <h3 className="timeline-title">딴생각 메모</h3>
      <p className="muted small">떠오른 일은 적어 두고 지금 할 일로 돌아가요.</p>
      <form className="inline-form" onSubmit={submit}>
        <input
          className="grow"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="예: 은행 가기"
          maxLength={500}
        />
        <button type="submit">적기</button>
      </form>
      {session.notes.length > 0 && (
        <ul className="note-list">
          {session.notes.map((n) => (
            <li key={n.id}>{n.content}</li>
          ))}
        </ul>
      )}
    </>
  )
}

type ResultProps = { session: FocusSession; onAgain: () => void; onClose: () => void }

/** 종료 결과와 휴식 타이머 */
function ResultCard({ session, onAgain, onClose }: ResultProps) {
  const now = useNow()
  const breakLeft = session.breakMinutes * 60 - (now - new Date(session.endedAt!).getTime()) / 1000
  const stopped = session.interruptions.filter((i) => i.type)

  return (
    <div className="focus-layout">
      <div className="card focus-main">
        <p className="muted">휴식</p>
        <div className={breakLeft <= 0 ? 'focus-timer over' : 'focus-timer'}>
          {breakLeft > 0 ? formatClock(breakLeft) : '휴식 끝'}
        </div>
        <div className="focus-actions">
          <button onClick={onAgain}>다시 집중</button>
          <Link to="/">오늘 화면으로</Link>
          <button className="ghost" onClick={onClose}>
            새로 시작
          </button>
        </div>
      </div>
      <div className="card result-card">
        <h3 className="timeline-title">
          {session.result ? RESULT_LABELS[session.result] : '종료'} · {session.dailyGoal?.content ?? '분류만'}
        </h3>
        {session.category && <CategoryBadge name={session.category.name} color={session.category.color} />}
        <dl className="result-stats">
          <dt>실제 집중</dt>
          <dd>{formatDuration(session.focusSeconds)}</dd>
          <dt>목표</dt>
          <dd>{session.focusMinutes}분</dd>
          <dt>뺀 시간</dt>
          <dd>{formatDuration(session.pausedSeconds)}</dd>
        </dl>
        {stopped.length > 0 && (
          <ul className="note-list">
            {stopped.map((i) => (
              <li key={i.id}>
                {INTERRUPTION_LABELS[i.type!]}{' '}
                {formatDuration((new Date(i.endedAt!).getTime() - new Date(i.startedAt).getTime()) / 1000)}
                {i.detection === 'TAB_HIDDEN' && ' (탭 이탈)'}
                {i.memo && <span className="muted"> · {i.memo}</span>}
              </li>
            ))}
          </ul>
        )}
        {session.notes.length > 0 && (
          <>
            <p className="small muted">딴생각 메모</p>
            <ul className="note-list">
              {session.notes.map((n) => (
                <li key={n.id}>{n.content}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

/** 오늘 하루 목표로, 또는 분류만 골라 시작한다. ?goal=ID로 목표를 미리 고를 수 있다. */
function StartForm({ categories, run }: { categories: Category[]; run: Run }) {
  const [params] = useSearchParams()
  const [goals, setGoals] = useState<DailyGoal[]>([])
  const [goalId, setGoalId] = useState<number | null>(Number(params.get('goal')) || null)
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [focusMinutes, setFocusMinutes] = useState(DEFAULT_FOCUS_MINUTES)
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK_MINUTES)

  useEffect(() => {
    getDailyGoals(todaySeoul())
      .then((d) => setGoals(d.filter((g) => g.status === 'TODO')))
      .catch(() => setGoals([]))
  }, [])

  const goal = goals.find((g) => g.id === goalId) ?? null
  // 분류를 따로 고르지 않으면 하루 목표의 분류를 물려받는다
  const effectiveCategoryId = categoryId ?? goal?.category?.id ?? null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    run(() =>
      startFocus({ dailyGoalId: goal?.id ?? null, categoryId, focusMinutes, breakMinutes, source: 'FOCUS_PAGE' }),
    )
  }

  return (
    <form className="card stack-form" onSubmit={submit}>
      <h2>무엇에 집중할까요?</h2>
      <label>
        하루 목표
        <select
          value={goalId ?? ''}
          onChange={(e) => {
            setGoalId(e.target.value ? Number(e.target.value) : null)
            setCategoryId(null)
          }}
        >
          <option value="">목표 없이 분류만</option>
          {goals.map((g) => (
            <option key={g.id} value={g.id}>
              {g.type === 'CORE' ? '★ ' : ''}
              {g.content}
            </option>
          ))}
        </select>
      </label>
      {goal?.firstAction && <p className="muted small">첫 행동: {goal.firstAction}</p>}
      <label>
        분류
        <select
          value={effectiveCategoryId ?? ''}
          onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">{goal ? '미분류' : '분류를 골라주세요'}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <span className="inline-form">
        <label>
          집중
          <input
            type="number"
            className="narrow"
            min={1}
            max={180}
            value={focusMinutes}
            onChange={(e) => setFocusMinutes(Number(e.target.value))}
          />
          분
        </label>
        <label>
          휴식
          <input
            type="number"
            className="narrow"
            min={0}
            max={60}
            value={breakMinutes}
            onChange={(e) => setBreakMinutes(Number(e.target.value))}
          />
          분
        </label>
      </span>
      <span>
        <button type="submit" disabled={!goal && effectiveCategoryId === null}>
          ▶ 시작
        </button>
      </span>
    </form>
  )
}

/** 확인 안 한 딴생각 메모. 확인하면 목록에서 빠진다. */
function NoteInbox() {
  const [notes, setNotes] = useState<DistractionNote[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    getDistractionNotes(false)
      .then(setNotes)
      .catch((e) => setError(errorMessage(e)))
  }, [])
  useEffect(load, [load])

  // 오늘 화면의 '확인 안 한 메모' 링크(#notes)로 오면 이 카드로 스크롤한다
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (window.location.hash === '#notes') box.current?.scrollIntoView({ behavior: 'smooth' })
  }, [notes])

  const check = (id: number) =>
    checkDistractionNote(id, true)
      .then(load)
      .catch((e) => setError(errorMessage(e)))

  return (
    <div className="card" id="notes" ref={box}>
      <h3 className="timeline-title">확인 안 한 딴생각 메모 {notes.length}개</h3>
      {error && <p className="error">{error}</p>}
      {notes.length === 0 ? (
        <p className="muted small">모두 확인했어요.</p>
      ) : (
        <ul className="unfinished-list">
          {notes.map((n) => (
            <li key={n.id}>
              <span>{n.content}</span>
              <span className="muted small">
                {n.sessionDate.slice(5).replace('-', '/')}
                {n.dailyGoalContent && ` · ${n.dailyGoalContent}`}
              </span>
              <button className="ghost" onClick={() => check(n.id)}>
                확인
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
