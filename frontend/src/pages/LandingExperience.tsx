import { Fragment, useState, type ReactNode } from 'react'
import GoogleButton from '../components/GoogleButton'
import logo from '../assets/brand/logo-horizontal-dark.svg'
import goalIcon from '../assets/illust/flow-icons/goal.svg'
import scheduleIcon from '../assets/illust/flow-icons/schedule.svg'
import reviewIcon from '../assets/illust/flow-icons/reflection.svg'
import coding from '../assets/illust/mascot-coding-v1.png'
import resume from '../assets/illust/mascot-resume-v1.png'
import interview from '../assets/illust/mascot-interview-v1.png'
import rest from '../assets/illust/mascot-rest-v1.png'
import exercise from '../assets/illust/mascot-exercise-v1.png'
import reading from '../assets/illust/mascot-reading-v1.png'
import wave from '../assets/illust/mascot-wave-v2.png'
import student from '../assets/illust/mascot-student-v2.png'
import added from '../assets/illust/mascot-goal-added-v1.png'
import removed from '../assets/illust/mascot-goal-removed-v1.png'
import journal from '../assets/illust/mascot-journal-v1.png'
import feedback from '../assets/illust/mascot-ai-feedback-v1.png'
import invite from '../assets/illust/mascot-invite-hand-v3.png'
import pointer from '../assets/cursors/pointer.svg'
import './LandingExperience.css'

const poses = { coding, resume, interview, rest, exercise, reading, wave, student, added, removed, journal, feedback }
type Reaction = { image: string; message: string; alt: string; tick: number }
const reaction = (image: string, message: string, alt = '스텝이'): Reaction => ({ image, message, alt, tick: 0 })
const events = [
  { title: '코딩 테스트', kind: 'coding', message: '문제 하나만 풀어봐요\n그걸로 충분해요' },
  { title: '자기소개서', kind: 'resume', message: '경험 하나부터 적어봐요\n문장은 천천히 다듬어요' },
  { title: '면접 준비', kind: 'interview', message: '질문 하나부터 준비해요\n차근차근 하면 돼요' },
  { title: '휴식', kind: 'rest', message: '잠깐 쉬어가요\n쉬는 것도 계획이에요' },
  { title: '운동', kind: 'exercise', message: '가볍게 움직여봐요\n기분 전환도 좋아요' },
  { title: '독서', kind: 'reading', message: '오늘은 조금 읽어봐요\n한 쪽도 좋아요' },
] as const

function Mascot({ value }: { value: Reaction }) {
  return <aside className="mascot-panel ld-rv d3" aria-live="polite"><div className="bubble">{value.message}</div><img key={value.tick} className="mascot changed" loading="lazy" src={value.image} alt={value.alt} width={170} height={170} /></aside>
}
function AppTop({ children }: { children: ReactNode }) {
  return <div className="app-top"><img src={logo} alt="Next Step" />{children}</div>
}
function Demo({ id, number, title, description, children }: { id: string; number: string; title: string; description: string; children: ReactNode }) {
  return <section className="screen demo-screen ld-sec" id={id} aria-labelledby={`${id}-title`}><div className="demo-heading"><span className="eyebrow ld-rv">{number}</span><h2 className="ld-rv d1" id={`${id}-title`}>{title}</h2><p className="ld-rv d2">{description}</p></div><div className="demo-layout">{children}</div></section>
}

type Goal = { id: number; title: string; detail: string; kind: keyof typeof poses; selected: boolean; custom?: boolean }
function GoalDemo() {
  const [goals, setGoals] = useState<Goal[]>([
    { id: 0, title: '코딩 테스트', detail: '문제 풀이, 주 3회', kind: 'coding', selected: true },
    { id: 1, title: '자기소개서', detail: '경험 정리, 주 2회', kind: 'resume', selected: true },
    { id: 2, title: '면접 준비', detail: '예상 질문, 주 2회', kind: 'interview', selected: false },
  ])
  const [input, setInput] = useState('정보처리기사 준비')
  const [pose, setPose] = useState(reaction(coding, '이번 주 목표를\n하나씩 정해봐요', '코딩 테스트를 준비하는 스텝이'))
  const count = goals.filter(goal => goal.selected).length
  const react = (image: string, message: string, alt: string) => setPose(previous => ({ image, message, alt, tick: previous.tick + 1 }))
  const toggle = (goal: Goal) => {
    if (goal.selected) {
      setGoals(previous => goal.custom ? previous.filter(item => item.id !== goal.id) : previous.map(item => item.id === goal.id ? { ...item, selected: false } : item))
      react(removed, `${goal.title} 목표를\n목록에서 뺐어요`, '목표를 정리하는 스텝이')
    } else if (count < 3) {
      setGoals(previous => previous.map(item => item.id === goal.id ? { ...item, selected: true } : item))
      react(poses[goal.kind], `${goal.title} 목표를\n추가했어요`, `${goal.title} 목표를 준비하는 스텝이`)
    } else react(wave, '목표 하나를 빼면\n다른 목표를 담을 수 있어요', '스텝이')
  }
  return <Demo id="goal-demo" number="01 목표 정하기" title="이번 주, 무엇을 준비할까요?" description="목표를 골라 추가해 보세요.">
    <div className="app-window ld-rv d2"><AppTop><small>이번 주 목표</small></AppTop><h3 className="app-title">준비할 목표를 골라요</h3><p className="app-subtitle">진행 중인 목표를 추가해 보세요.</p>
      <div className="goal-summary"><span>이번 주 목표</span><strong>{count} / 3</strong></div>
      <div className="goal-list">{goals.map(goal => <button key={goal.id} className="goal-option" type="button" aria-pressed={goal.selected} onClick={() => toggle(goal)}><span className="goal-check" aria-hidden="true">{goal.selected ? '✓' : ''}</span><span className="goal-copy"><b>{goal.title}</b><small>{goal.detail}</small></span><span className="goal-status">{goal.selected ? '선택됨' : '목표 추가'}</span></button>)}</div>
      {count < 3 && <form className="custom-goal" onSubmit={event => {
        event.preventDefault()
        const title = input.trim()
        if (!title || count >= 3) return
        const kind = /정보처리기사|자격증|시험|독서|공부/.test(title) ? 'reading' : 'added'
        setGoals(previous => [...previous, { id: Math.max(...previous.map(goal => goal.id), 0) + 1, title, detail: '이번 주에 직접 정한 목표', kind, selected: true, custom: true }])
        setInput('')
        react(poses[kind], `${title} 목표를\n목록에 담았어요`, '새 목표를 함께 준비하는 스텝이')
      }}><input aria-label="직접 목표 입력" maxLength={24} placeholder="직접 목표 입력" value={input} onChange={event => setInput(event.target.value)} /><button className="small-button" type="submit">추가</button></form>}
    </div><Mascot value={pose} />
  </Demo>
}

function ScheduleDemo() {
  const [cells, setCells] = useState<Record<string, number>>({ '0-0': 0, '1-1': 1, '2-2': 2, '3-3': 0 })
  const [nextEvent, setNextEvent] = useState(0)
  const [actual, setActual] = useState(false)
  const [pose, setPose] = useState(reaction(wave, '빈 칸을 눌러\n일정을 넣어봐요'))
  const days = ['월', '화', '수', '목', '금']
  const changeView = (value: boolean) => {
    setActual(value)
    setPose(previous => ({ ...reaction(value ? student : wave, value ? '계획과 달라도 괜찮아요\n해낸 만큼 기록해요' : '공부와 휴식을 함께\n내 하루에 맞춰봐요', value ? '실제 기록을 보는 스텝이' : '스텝이'), tick: previous.tick + 1 }))
  }
  return <Demo id="schedule-demo" number="02 시간표 채우기" title="내 하루에 맞춰 일정을 넣어요" description="빈 칸을 누르면 일정을 추가하고, 채운 칸은 다른 일정으로 바꿀 수 있어요.">
    <div className="app-window ld-rv d2"><AppTop><div className="schedule-top-controls" role="group" aria-label="시간표 보기"><button type="button" className={!actual ? 'active' : ''} aria-pressed={!actual} onClick={() => changeView(false)}>계획</button><button type="button" className={actual ? 'active' : ''} aria-pressed={actual} onClick={() => changeView(true)}>실제</button></div></AppTop>
      <div className="schedule-demo-head"><strong>이번 주</strong><span>{actual ? '계획과 달라도 괜찮아요' : '이번 주 시간을 내 생활에 맞춰요'}</span></div>
      <div className="week" role="grid" aria-label="월요일부터 금요일까지 오전 9시부터 오후 1시"><div className="week-row" role="row"><span /><>{days.map(day => <span className="day" role="columnheader" key={day}>{day}</span>)}</></div>
        {Array.from({ length: 5 }, (_, row) => <div className="week-row" role="row" key={row}><span className="time-label" role="rowheader">{String(row + 9).padStart(2, '0')}</span>{days.map((day, col) => {
          const key = `${row}-${col}`, current = cells[key], item = current === undefined ? undefined : events[current]
          return <button key={key} type="button" role="gridcell" className={`slot${item ? ` filled ${item.kind}` : ''}`} aria-label={`${day}요일 ${row + 9}시 ${item ? `${item.title}. 눌러 다른 일정으로 바꾸기` : '빈 일정 칸'}`} onClick={() => {
            const index = current === undefined ? nextEvent % events.length : (current + 1) % events.length
            const event = events[index]
            setCells(previous => ({ ...previous, [key]: index }))
            if (current === undefined) setNextEvent(previous => previous + 1)
            setPose(previous => ({ image: poses[event.kind], message: `${event.message}\n${actual ? '실제 기록도' : '계획도'} 남겨봐요`, alt: `${event.title}에 맞춰 반응하는 스텝이`, tick: previous.tick + 1 }))
          }}>{item?.title}</button>
        })}</div>)}
      </div><p className="calendar-footer">공부와 휴식을 함께 넣어 내 하루를 그려보세요.</p>
    </div><Mascot value={pose} />
  </Demo>
}

const journalFields = [
  ['잘한 점', '예: 면접 질문을 정리하고 답변을 연습했어요.'],
  ['아쉬운 점', '예: 계획했던 코딩 테스트 공부를 많이 못 했어요.'],
  ['다음 주에 바꿀 한 가지', '예: 월요일과 수요일에 30분씩 문제를 풀어볼래요.'],
]
function ReviewDemo() {
  const [showFeedback, setShowFeedback] = useState(false)
  const [values, setValues] = useState(['', '', ''])
  return <Demo id="review-demo" number="03 주간 회고" title="한 주를 함께 돌아보고 다음 주를 준비해요" description="주간 일지를 쓰면 AI가 기록을 바탕으로 다음 주에 해볼 일을 제안해요.">
    <div className="app-window ld-rv d2"><AppTop><small>지난 주 회고</small></AppTop>
      {!showFeedback ? <form className="journal-form" onSubmit={event => { event.preventDefault(); setShowFeedback(true) }}>
        <h3 className="app-title">이번 주 일지</h3><p className="app-subtitle">잘한 점과 아쉬운 점을 적고, 다음 주에 바꿀 한 가지를 정해봐요.</p>
        {journalFields.map(([label, example], index) => <label key={label}>{label}<span className="textarea-example"><textarea placeholder=" " value={values[index]} onChange={event => setValues(previous => previous.map((value, i) => i === index ? event.target.value : value))} /><span className="textarea-example-text" aria-hidden="true">{example}</span></span></label>)}
        <div className="journal-actions"><span className="helper">주간 일지를 작성한 뒤 피드백을 확인해요.</span><span className="click-cue-wrap"><button className="small-button" type="submit">AI 피드백 예시 보기</button><span className="click-cue" aria-hidden="true"><img src={pointer} alt="" /><svg className="click-burst" viewBox="0 0 14 14"><path d="M7 1V-1m4 5 2-2m-2 6 2 1" fill="none" stroke="#e0d0ff" strokeWidth="1.5" strokeLinecap="round" /></svg></span></span></div>
      </form> : <section className="feedback-result" aria-label="AI 피드백 예시" aria-live="polite"><div className="feedback-result-head"><div><span className="eyebrow">AI 피드백 예시</span><h3 className="app-title">이번 주를 돌아봤어요</h3></div><button className="small-button" type="button" onClick={() => setShowFeedback(false)}>일지 다시 보기</button></div><p className="feedback-summary">면접 준비에 계획한 시간의 대부분을 썼어요.</p><div className="feedback-point"><b>잘한 점</b><p>면접 준비를 꾸준히 이어가고 주간 일지로 다음 할 일을 정리했어요.</p></div><div className="feedback-point"><b>다음 주에 해 볼 것</b><p>코딩 테스트 문제 풀이를 짧은 일정으로 나눠 시간표에 넣어보세요.</p></div><p className="helper">실제 피드백은 동의 후, 완료된 주에 실제 기록이 2시간 이상일 때 주 최대 2회 받을 수 있어요.</p></section>}
    </div><Mascot value={showFeedback ? reaction(feedback, 'AI가 이번 주 기록을 읽고\n다음 주 할 일을 제안해요', 'AI 피드백 카드를 살펴보는 스텝이') : reaction(journal, '잘한 점과 아쉬운 점을\n차근차근 적어봐요', '연필로 주간 일지를 쓰는 스텝이')} />
  </Demo>
}

export default function LandingExperience() {
  const features = [
    { id: 'goal-demo', image: goalIcon, title: '목표를 정리해요', body: '코딩 테스트, 자기소개서, 면접 준비를 이번 주 목표로 모아요.', link: '목표 체험 보기' },
    { id: 'schedule-demo', image: scheduleIcon, title: '시간표를 채워요', body: '공부와 휴식 시간을 내 생활에 맞게 직접 배치해요.', link: '일정 체험 보기' },
    { id: 'review-demo', image: reviewIcon, title: '주간 회고를 남겨요', body: '일지를 쓰고 AI 피드백으로 다음 주를 준비해요.', link: '회고 체험 보기' },
  ]
  return <Fragment>
    <section className="screen ld-sec" id="feature-overview" aria-labelledby="overview-title"><div className="container"><div className="section-heading"><span className="eyebrow ld-rv">핵심 기능 세 가지</span><h2 className="ld-rv d1" id="overview-title">준비부터 회고까지, 한 주를 이어서</h2><p className="ld-rv d2">각 기능을 눌러 실제 화면처럼 체험해 보세요.</p></div><div className="feature-grid">{features.map((feature, index) => <a className={`feature ld-rv d${index + 1}`} key={feature.id} href={`#${feature.id}`}><img src={feature.image} alt="" /><b>{feature.title}</b><p>{feature.body}</p><small>{feature.link} →</small></a>)}</div></div></section>
    <GoalDemo /><ScheduleDemo /><ReviewDemo />
    <section className="screen hero ld-sec" id="start" aria-label="시작하기"><div className="hero-inner"><img className="hero-mascot ld-rv" loading="lazy" src={invite} alt="둥근 팔로 함께 시작하자고 권하는 스텝이" width={190} height={190} /><span className="eyebrow ld-rv d1">스텝이와 함께 시작해요</span><h2 className="ld-rv d1 ld-h1">하루 한 칸씩, <span className="ld-grad">내 시간표</span>에 쌓아요</h2><p className="ld-rv d2">목표부터 회고까지, 다음 한 칸을 같이 쌓아가요.</p><GoogleButton className="ld-rv d3">Google로 계속하기</GoogleButton><a className="scroll-hint ld-rv d3" href="#top">첫 화면으로</a></div></section>
  </Fragment>
}
