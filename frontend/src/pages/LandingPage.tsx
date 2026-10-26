import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CONTACT_EMAIL } from '../legal'
import logoDark from '../assets/brand/logo-horizontal-dark.svg'
import stepeBody from '../assets/illust/stepe-body-layer-v1.png'
import stepeWaveArm from '../assets/illust/stepe-arm-wave-layer-v1.png'
import stepeRightArm from '../assets/illust/stepe-arm-right-layer-v1.png'
import stepeEyes from '../assets/illust/stepe-eyes-layer.svg'

import LandingExperience from './LandingExperience'
import GoogleButton from '../components/GoogleButton'

export default function LandingPage() {
  const detail = useRef<HTMLElement>(null)
  const [cursorPressed, setCursorPressed] = useState(false)
  const [clickRing, setClickRing] = useState<{ x: number; y: number; id: number } | null>(null)
  useEffect(() => {
    const release = () => setCursorPressed(false)
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    window.addEventListener('blur', release)
    return () => {
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
      window.removeEventListener('blur', release)
    }
  }, [])
  useEffect(() => {
    if (!clickRing) return
    const timeout = window.setTimeout(() => setClickRing(null), 280)
    return () => window.clearTimeout(timeout)
  }, [clickRing])
  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>('.ld-sec')
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('on'); observer.unobserve(entry.target) }
    }), { threshold: 0.2 })
    sections.forEach(section => observer.observe(section))
    return () => observer.disconnect()
  }, [])
  return (
    <div className={`ld${cursorPressed ? ' ld-cursor-pressed' : ''}`} onPointerDown={event => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return
      setCursorPressed(true)
      setClickRing({ x: event.clientX, y: event.clientY, id: event.timeStamp })
    }}>
      {clickRing && <span key={clickRing.id} className="ld-click-ring" aria-hidden="true" style={{ left: clickRing.x, top: clickRing.y }} />}
      <section id="top" className="ld-sec ld-hero" aria-label="소개">
        <span className="ld-glow" style={{ width: 640, height: 540, background: '#F9A8D4', left: -160, top: -180 }} />
        <span className="ld-glow" style={{ width: 660, height: 580, background: '#A78BFA', right: -180, bottom: -220, animationDuration: '24s' }} />
        <span className="ld-glow" style={{ width: 480, height: 440, background: '#93C5FD', left: '40%', top: -240, opacity: 0.24, animationDuration: '28s' }} />
        <header className="ld-header">
          <a className="ld-logo" href="#top"><img className="ld-logo-image" src={logoDark} alt="Next Step" /></a>
        </header>
        <div className="ld-hero-body">
          <div className="ld-hero-art"><AnimatedMascot /></div>
          <span className="ld-rv d1 ld-tag">오늘도 한 칸 자라는 성장러를 위해</span>
          <h1 className="ld-rv d2 ld-h1">하루 한 칸씩, <span className="ld-grad">내 시간표</span>에 쌓아요</h1>
          <div className="ld-rv d3 ld-ctas">
            <GoogleButton>Google로 계속하기</GoogleButton>
            <span className="ld-signin">Google 계정으로 가입하거나 로그인해요.</span>
            <button type="button" className="ld-more" onClick={() => detail.current?.scrollIntoView({ behavior: 'smooth' })}>
              어떤 앱인지 볼래요<span aria-hidden="true">↓</span>
            </button>
          </div>
        </div>
      </section>

      <section ref={detail} className="ld-experience" aria-label="기능 소개와 체험"><LandingExperience /></section>

      <footer className="ld-footer">
        <a className="ld-logo" href="#top"><img className="ld-logo-image" src={logoDark} alt="Next Step" /></a>
        <Link to="/terms">이용약관</Link>
        <Link to="/privacy">개인정보 처리방침</Link>
        <ContactLink />
      </footer>
    </div>
  )
}

function AnimatedMascot({ className = '' }: { className?: string }) {
  return (
    <div className={`ld-hero-rig ${className}`} role="img" aria-label="스텝이">
      <div className="ld-hero-wave-arm" aria-hidden="true">
        <img src={stepeWaveArm} alt="" draggable="false" />
      </div>
      <img className="ld-hero-right-arm" src={stepeRightArm} alt="" draggable="false" />
      <img className="ld-hero-body-layer" src={stepeBody} alt="" draggable="false" />
      <img className="ld-hero-eyes" src={stepeEyes} alt="" draggable="false" />
    </div>
  )
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
      {copied && (
        <span className="ld-contact-tip" role="status">
          메일 주소를 복사했어요
        </span>
      )}
    </span>
  )
}
