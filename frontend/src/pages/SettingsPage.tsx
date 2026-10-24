import { useState } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { agreeAi, changeNotifications, changePurpose, withdraw, withdrawAi, type NotificationSettings, type Purpose } from '../api/me'
import { refreshReminders } from '../utils/reminders'
import { useAuth } from '../auth/useAuth'
import { CONTACT_EMAIL } from '../legal'

/** 앱 안 알림 종류(1-5) */
const NOTIFICATIONS: { key: 'block' | 'today' | 'weekly' | 'shutdown'; label: string; desc: string }[] = [
  { key: 'block', label: '블록 시작', desc: '계획한 시간이 되면 지금 할 일을 알려줘요' },
  { key: 'today', label: '오늘 요약', desc: '일정 화면에 오늘 실제 공부와 계획대로 비율' },
  { key: 'weekly', label: '한 주 마무리', desc: '금요일부터 주간 일지 쓰기를 알려줘요' },
  { key: 'shutdown', label: '하루 마무리', desc: '정한 시각이 지나면 컨디션과 메모 남기기' },
]
const SHUTDOWN_HOURS = [20, 21, 22, 23]

const PURPOSES: { id: Purpose; label: string }[] = [
  { id: 'JOB_SEEKER', label: '취업 준비생' },
  { id: 'CAREER_CHANGER', label: '이직 준비 중' },
]

/** 설정(docs/design.md 11-6 2-6): 내 정보, 약관, 계정만 */
export default function SettingsPage() {
  const { me, setMe, signOut } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const setNotifications = (next: NotificationSettings) =>
    run(async () => {
      setMe(await changeNotifications(next))
      refreshReminders()
    })

  const pick = (purpose: Purpose) => purpose !== me.purpose && run(async () => setMe(await changePurpose(purpose)))

  const copyEmail = () =>
    navigator.clipboard
      ?.writeText(CONTACT_EMAIL)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      })
      .catch(() => setCopied(false))

  const leave = () => {
    if (!confirm('정말 탈퇴할까요? 목표, 할 일, 시간표, 기록이 모두 바로 지워지고 되돌릴 수 없어요.')) return
    run(async () => {
      await withdraw()
      // 세션이 끝났으니 처음(랜딩)부터 다시 연다
      window.location.href = '/'
    })
  }

  return (
    <section className="settings-page">
      <h1>설정</h1>
      {error && <p className="error-banner">{error}</p>}

      <h2 className="settings-cap">내 정보</h2>
      <div className="settings-box">
        <div className="settings-row">
          {me.pictureUrl ? (
            <img className="settings-avatar" src={me.pictureUrl} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span className="settings-avatar">{(me.name ?? me.email).slice(0, 1)}</span>
          )}
          <div className="settings-text">
            <div>{me.name ?? me.email}</div>
            <div className="muted small">{me.email} 구글 계정</div>
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-text">준비 중인 것</div>
          <div className="segmented" role="radiogroup" aria-label="준비 중인 것">
            {PURPOSES.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={me.purpose === p.id}
                className={me.purpose === p.id ? 'active' : undefined}
                disabled={busy}
                onClick={() => pick(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-text">
            <span>AI 주간 피드백</span>
            <span className="muted small">기록과 주간 일지 글을 Anthropic(Claude)에 보내 피드백을 만들어요</span>
          </div>
          <div className="segmented" role="radiogroup" aria-label="AI 주간 피드백">
            {[true, false].map((on) => (
              <button
                key={String(on)}
                type="button"
                role="radio"
                aria-checked={me.aiAgreed === on}
                className={me.aiAgreed === on ? 'active' : undefined}
                disabled={busy}
                onClick={() => me.aiAgreed !== on && run(async () => setMe(await (on ? agreeAi() : withdrawAi())))}
              >
                {on ? '켜기' : '끄기'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <h2 className="settings-cap">
        알림 <span className="muted small">앱을 열어 둔 동안 오른쪽 아래에 떠요</span>
      </h2>
      <div className="settings-box">
        {NOTIFICATIONS.map((n) => (
          <div key={n.key} className="settings-row">
            <div className="settings-text">
              <span>{n.label}</span>
              <span className="muted small">{n.desc}</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={me.notifications[n.key]}
              aria-label={n.label}
              className={me.notifications[n.key] ? 'switch on' : 'switch'}
              disabled={busy}
              onClick={() => setNotifications({ ...me.notifications, [n.key]: !me.notifications[n.key] })}
            />
          </div>
        ))}
        <div className={me.notifications.shutdown ? 'settings-row settings-sub' : 'settings-row settings-sub off'}>
          <div className="settings-text">알림 시각</div>
          <div className="segmented" role="radiogroup" aria-label="하루 마무리 알림 시각">
            {SHUTDOWN_HOURS.map((h) => (
              <button
                key={h}
                type="button"
                role="radio"
                aria-checked={me.notifications.shutdownHour === h}
                className={me.notifications.shutdownHour === h ? 'active' : undefined}
                disabled={busy || !me.notifications.shutdown}
                onClick={() => setNotifications({ ...me.notifications, shutdownHour: h })}
              >
                {h}시
              </button>
            ))}
          </div>
        </div>
      </div>

      <h2 className="settings-cap">약관</h2>
      <div className="settings-box">
        <Link className="settings-row link" to="/terms">
          <span className="settings-text">이용약관</span>
          <span className="settings-chev">›</span>
        </Link>
        <Link className="settings-row link" to="/privacy">
          <span className="settings-text">개인정보 처리방침</span>
          <span className="settings-chev">›</span>
        </Link>
        <button type="button" className="settings-row link" onClick={copyEmail}>
          <span className="settings-text">문의하기</span>
          <span className="muted small" role="status">
            {copied ? '메일 주소를 복사했어요' : '이메일 복사'}
          </span>
        </button>
      </div>

      <h2 className="settings-cap">계정</h2>
      <div className="settings-box">
        <button type="button" className="settings-row link" onClick={signOut}>
          <span className="settings-text">로그아웃</span>
          <span className="settings-chev">›</span>
        </button>
        <button type="button" className="settings-row link" onClick={leave} disabled={busy}>
          <span className="settings-text">
            <span className="settings-danger">탈퇴하기</span>
            <span className="muted small">계정과 모든 기록을 바로 지워요. 되돌릴 수 없어요.</span>
          </span>
          <span className="settings-chev">›</span>
        </button>
      </div>
    </section>
  )
}
