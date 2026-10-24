import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { GOOGLE_LOGIN_URL } from '../api/me'
import { CONTACT_EMAIL } from '../legal'
import { todaySeoul } from '../utils/date'
import catCoding from '../assets/illust/cat-coding.svg'
import catMajor from '../assets/illust/cat-major.svg'
import catResume from '../assets/illust/cat-resume.svg'
import decoBook from '../assets/illust/deco-book.svg'
import decoCalendar from '../assets/illust/deco-calendar.svg'
import decoCloud from '../assets/illust/deco-cloud.svg'
import decoCoffee from '../assets/illust/deco-coffee.svg'
import decoPencil from '../assets/illust/deco-pencil.svg'
import decoPlanet from '../assets/illust/deco-planet.svg'
import decoStar from '../assets/illust/deco-star.svg'
import decoTrophy from '../assets/illust/deco-trophy.svg'
import mascotStudent from '../assets/illust/mascot-student.svg'
import mascotWave from '../assets/illust/mascot-wave.svg'
import mascotWorker from '../assets/illust/mascot-worker.svg'

/** 장식이 가운데에서 터져 나와 자리 잡는 위치(px)와 크기 */
type Burst = { src: string; size: number; x: number; y: number; r: number; delay: number }

const HERO_BURSTS: Burst[] = [
  { src: decoStar, size: 74, x: -250, y: -40, r: -12, delay: 0.35 },
  { src: decoCalendar, size: 90, x: 260, y: -70, r: 8, delay: 0.45 },
  { src: decoBook, size: 80, x: -200, y: 120, r: 6, delay: 0.55 },
  { src: decoCoffee, size: 66, x: 220, y: 120, r: -10, delay: 0.65 },
]

const PHONE_BURSTS: Burst[] = [
  { src: decoPencil, size: 96, x: -360, y: -170, r: -10, delay: 0.1 },
  { src: decoTrophy, size: 86, x: 360, y: -190, r: 12, delay: 0.2 },
  { src: decoCloud, size: 84, x: -380, y: 140, r: 8, delay: 0.3 },
  { src: decoPlanet, size: 92, x: 370, y: 150, r: -6, delay: 0.4 },
]

const STEPS = [
  { title: '목표 정하기', body: '면접 준비처럼 지금 할 것 하나를 정해요.' },
  { title: '시간표에 칠하기', body: '공부할 시간을 끌어서 칠하면 그대로 일정이 돼요.' },
  { title: '해낸 만큼 돌아보기', body: '계획한 시간 옆에 실제로 한 시간이 쌓여요. 주말에 한 번 봐요.' },
]

const FEATURES = [
  { title: '목표로 바로 추가', body: '"면접"만 쳐도 오늘 할 일에 들어가요.' },
  { title: '계획과 실제', body: '계획한 시간 옆에 실제로 한 시간이 같이 보여요.' },
  { title: '세부 내용별 시간', body: '자기소개 연습 2시간, 모의 질문 1시간처럼 따로 쌓여요.' },
  { title: '주간 회고', body: '일주일에 한 번, 세 줄만 적으면 돼요.' },
]

/**
 * 랜딩(docs/design.md 11-5, 11-6 2-4): 로그인 안 한 사람의 첫 화면. 프로토타입 Landing 보드를 옮겼다.
 * 섹션이 보이면 글자가 아래에서 올라오고 장식이 터져 나온다. "동작 줄이기"면 모두 멈춘다(CSS).
 */
export default function LandingPage() {
  const detail = useRef<HTMLElement>(null)

  // 화면에 들어온 섹션에 on을 붙인다(한 번 보이면 그대로)
  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>('.ld-sec')
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('on')
            io.unobserve(e.target)
          }
        }),
      { threshold: 0.2 },
    )
    sections.forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [])

  return (
    <div className="ld">
      <section className="ld-sec ld-hero" aria-label="소개">
        <span className="ld-glow" style={{ width: 640, height: 540, background: '#F9A8D4', left: -160, top: -180 }} />
        <span className="ld-glow" style={{ width: 660, height: 580, background: '#A78BFA', right: -180, bottom: -220, animationDuration: '24s' }} />
        <span className="ld-glow" style={{ width: 480, height: 440, background: '#93C5FD', left: '40%', top: -240, opacity: 0.24, animationDuration: '28s' }} />
        {[
          [9, 22, 0],
          [24, 76, 1.4],
          [72, 14, 2.6],
          [88, 64, 0.7],
          [55, 88, 3.2],
        ].map(([l, t, d]) => (
          <span key={`${l}-${t}`} className="ld-spark" style={{ left: `${l}%`, top: `${t}%`, animationDelay: `${d}s` }} />
        ))}

        <header className="ld-header">
          <span className="ld-logo">
            Next <span className="ld-grad-blue">Step</span>
          </span>
        </header>

        <div className="ld-hero-body">
          <div className="ld-hero-art">
            {HERO_BURSTS.map((b) => (
              <BurstImg key={b.src} {...b} />
            ))}
            <img className="ld-hero-char ld-floaty" src={mascotWave} alt="손을 흔드는 스텝이" width={240} height={260} />
          </div>
          <span className="ld-rv d1 ld-tag">오늘도 한 칸 자라는 성장러를 위해</span>
          <h1 className="ld-rv d2 ld-h1">
            하루 한 칸씩, <span className="ld-grad">내 시간표</span>에 쌓아요
          </h1>
          <div className="ld-rv d3 ld-ctas">
            <GoogleButton>Google로 시작하기</GoogleButton>
            {/* 기존 사용자 로그인은 시작 버튼 바로 아래로 모은다(2-4 C안). 같은 구글 로그인 */}
            <span className="ld-signin">
              무료예요. 이미 계정이 있다면 <a href={GOOGLE_LOGIN_URL}>로그인</a>
            </span>
            {/* 보조 동작은 아래에 작은 글자로(시작 버튼만 주인공) */}
            <button type="button" className="ld-more" onClick={() => detail.current?.scrollIntoView({ behavior: 'smooth' })}>
              어떤 앱인지 볼래요
              <span aria-hidden="true">↓</span>
            </button>
          </div>
        </div>
      </section>

      <section ref={detail} className="ld-sec ld-start" aria-label="시간표">
        <span className="ld-rv ld-eyebrow">할 일은 많은데 시간은 늘 없죠</span>
        <h2 className="ld-rv d1 ld-h2">
          그래서 시간표에
          <br />
          먼저 넣어 두는 거예요
        </h2>
        <div className="ld-phone-wrap">
          {PHONE_BURSTS.map((b) => (
            <BurstImg key={b.src} {...b} />
          ))}
          <span className="ld-badge" style={{ left: -230, top: 60, transitionDelay: '0.6s' }}>
            <span>이번 주 7시간 20분</span>
          </span>
          <span className="ld-badge" style={{ right: -220, top: 300, transitionDelay: '0.75s' }}>
            <span>계획대로 68%</span>
          </span>
          <div className="ld-rv d2 ld-phone">
            <span className="ld-notch" />
            <span className="ld-phone-top">
              <span>
                <span className="ld-today">오늘</span>
                {todayLabel()}
              </span>
              <span className="ld-muted">3시간 30분</span>
            </span>
            <PhoneItem icon={catMajor} tint="147,197,253" color="#BFDBFE" title="면접 준비" time="19:30–21:00" />
            <PhoneItem icon={catCoding} tint="196,181,253" color="#DDD6FE" title="코딩 테스트 준비" time="21:15–22:00" />
            <PhoneItem icon={catResume} tint="110,231,183" color="#A7F3D0" title="이력서와 경력기술서 정리" time="22:00–22:30" />
            <div className="ld-phone-add">+ 할 일을 끌어다 놓기</div>
          </div>
        </div>
      </section>

      <section className="ld-sec ld-block" aria-label="이런 분께">
        <span className="ld-rv ld-eyebrow">누구를 위한 앱인가요</span>
        <h2 className="ld-rv d1 ld-h2">이런 분께 잘 맞아요</h2>
        <div className="ld-who">
          <article className="ld-rv d2 ld-card">
            <img src={mascotStudent} alt="" width={96} />
            <div>
              <h3>취업 준비생</h3>
              <p>오전엔 코테 두 문제, 오후엔 자소서 한 문항. 할 게 많을수록 한 주를 미리 나눠 둬요.</p>
            </div>
          </article>
          <article className="ld-rv d3 ld-card">
            <img src={mascotWorker} alt="" width={96} />
            <div>
              <h3>이직 준비 중</h3>
              <p>다니면서 몰래 준비하든, 그만두고 하루가 길어졌든. 이력서와 면접, 공부 시간을 정해 두고 리듬을 지켜요.</p>
            </div>
          </article>
        </div>
      </section>

      <section className="ld-sec ld-block" aria-label="쓰는 법">
        <span className="ld-rv ld-eyebrow">어떻게 쓰나요</span>
        <h2 className="ld-rv d1 ld-h2">쓰는 법은 간단해요</h2>
        <ol className="ld-steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className={`ld-rv d${i + 1} ld-card`}>
              <span className="ld-step-no">{i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="ld-sec ld-block" aria-label="기능">
        <span className="ld-rv ld-eyebrow">기능</span>
        <h2 className="ld-rv d1 ld-h2">써 보면 편한 것들</h2>
        <div className="ld-features">
          {FEATURES.map((f, i) => (
            <article key={f.title} className={`ld-rv d${(i % 3) + 1} ld-card`}>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="ld-sec ld-block ld-final" aria-label="시작하기">
        <img className="ld-rv ld-floaty" src={mascotWave} alt="" width={120} />
        <h2 className="ld-rv d1 ld-h2">오늘 저녁 한 칸부터 넣어 봐요</h2>
        <p className="ld-rv d2 ld-muted">구글 계정으로 바로 시작해요. 무료예요.</p>
        <div className="ld-rv d3">
          <GoogleButton>Google로 시작하기</GoogleButton>
        </div>
      </section>

      <footer className="ld-footer">
        <span>© 2026 Next Step</span>
        <Link to="/terms">이용약관</Link>
        <Link to="/privacy">개인정보 처리방침</Link>
        <ContactLink />
      </footer>
    </div>
  )
}

/** 휴대폰 목업의 날짜: 오늘(서울)을 'M월 D일'로 */
function todayLabel() {
  const today = todaySeoul()
  return `${Number(today.slice(5, 7))}월 ${Number(today.slice(8))}일`
}

/**
 * 문의: 메일 앱이 없으면 mailto가 아무 반응이 없어서, 누르면 주소를 복사하고 바로 알려 준다.
 * 메일 앱이 있으면 그대로 열린다
 */
function ContactLink() {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard
      ?.writeText(CONTACT_EMAIL)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      })
      .catch(() => setCopied(false))
  }
  return (
    <span className="ld-contact">
      <a href={`mailto:${CONTACT_EMAIL}`} onClick={copy}>
        문의
      </a>
      <span className="ld-contact-mail">{CONTACT_EMAIL}</span>
      {copied && (
        <span className="ld-contact-tip" role="status">
          메일 주소를 복사했어요
        </span>
      )}
    </span>
  )
}

function BurstImg({ src, size, x, y, r, delay }: Burst) {
  return (
    <span
      className="ld-burst"
      style={{ '--s': `${size}px`, '--x': `${x}px`, '--y': `${y}px`, '--r': `${r}deg`, transitionDelay: `${delay}s` } as React.CSSProperties}
    >
      <img src={src} alt="" />
    </span>
  )
}

function PhoneItem({ icon, tint, color, title, time }: { icon: string; tint: string; color: string; title: string; time: string }) {
  return (
    <div className="ld-phone-item" style={{ background: `rgba(${tint},.16)`, color }}>
      <img src={icon} width={24} height={24} alt="" />
      <span>
        <strong>{title}</strong>
        <span>{time}</span>
      </span>
    </div>
  )
}

function GoogleButton({ children }: { children: ReactNode }) {
  return (
    <a className="ld-google" href={GOOGLE_LOGIN_URL}>
      <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      {children}
    </a>
  )
}
