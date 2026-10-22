import { useEffect, useState } from 'react'
import { getHealth, type Health } from '../api/health'

export default function TodayPage() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch((e: Error) => setError(e.message))
  }, [])

  return (
    <section>
      <h1>오늘</h1>
      <p className="muted">핵심 목표 3개, 집중 모드, 시간 블록은 1-2단계에서 이 화면에 들어옵니다.</p>

      <div className="card">
        <h2>서버 연결 상태</h2>
        {error && <p className="status down">연결 실패: {error}</p>}
        {!error && !health && <p className="muted">확인 중…</p>}
        {health && (
          <ul className="status-list">
            <li>
              서버 <span className={health.status === 'UP' ? 'status up' : 'status down'}>{health.status}</span>
            </li>
            <li>
              DB <span className={health.database === 'UP' ? 'status up' : 'status down'}>{health.database}</span>
            </li>
            <li>
              서버 시각 {new Date(health.serverTime).toLocaleString('ko-KR')} ({health.zone})
            </li>
          </ul>
        )}
      </div>
    </section>
  )
}
