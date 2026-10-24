import { useEffect, useState } from 'react'
import { errorMessage } from '../api/client'
import { agreeAi } from '../api/me'
import { createWeeklyFeedback, getWeeklyJournal, parseFeedback, type AiFeedbackBlock, type WeeklyJournal } from '../api/reviews'
import { useAuth } from '../auth/useAuth'
import { weekLabel } from '../utils/date'

const BLOCKED: Record<AiFeedbackBlock, string> = {
  UNAVAILABLE: '지금은 쓸 수 없어요',
  NOT_ENDED: '주가 끝난 뒤에 받을 수 있어요',
  TOO_LITTLE: '기록이 2시간 넘게 쌓이면 받을 수 있어요',
  LIMIT: '이번 주 피드백은 다 받았어요',
}

/**
 * 지난 주 AI 피드백(docs/design.md 9-1). 버튼을 눌러야 만들고, 처음 한 번 동의를 받는다.
 * 결과는 한 줄 요약, 잘한 점, 다음 주에 해 볼 것.
 */
export default function WeeklyFeedbackCard({ weekStart }: { weekStart: string }) {
  const { me, setMe } = useAuth()
  const [journal, setJournal] = useState<WeeklyJournal | null>(null)
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getWeeklyJournal(weekStart)
      .then(setJournal)
      .catch((e) => setError(errorMessage(e)))
  }, [weekStart])

  if (!journal) return error ? <p className="error">{error}</p> : null

  const feedback = parseFeedback(journal.aiSummary)
  const { count, blocked } = journal.aiFeedback

  const run = async (agree: boolean) => {
    setBusy(true)
    setError(null)
    try {
      if (agree) setMe(await agreeAi())
      setAsking(false)
      setJournal(await createWeeklyFeedback(weekStart))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const request = () => (me.aiAgreed ? run(false) : setAsking(true))

  return (
    <div className="card weekly-feedback">
      <div className="daily-panel-head">
        <h3 className="timeline-title">지난 주 피드백 {weekLabel(weekStart)}</h3>
        {!asking && blocked !== 'LIMIT' && (
          <button type="button" className={feedback ? 'ghost' : undefined} disabled={busy || blocked !== null} onClick={request}>
            {busy ? '만드는 중…' : feedback ? '한 번 더 받기' : '피드백 받기'}
          </button>
        )}
      </div>

      {feedback ? (
        <div className="weekly-feedback-body">
          <p className="weekly-feedback-summary">{feedback.summary}</p>
          <dl>
            <dt>잘한 점</dt>
            <dd>{feedback.good}</dd>
            <dt>다음 주에 해 볼 것</dt>
            <dd>
              <ul>
                {feedback.suggestions.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </dd>
          </dl>
        </div>
      ) : (
        !asking && <p className="muted small">{blocked ? BLOCKED[blocked] : '지난 주 기록과 일지를 보고 다음 주에 해 볼 것을 알려 줘요.'}</p>
      )}
      {feedback && blocked && blocked !== 'TOO_LITTLE' && <p className="muted small">{BLOCKED[blocked]}</p>}
      {feedback && !blocked && count > 0 && <p className="muted small">한 번 더 받기는 {journal.aiFeedback.maxCount - count}번 남았어요</p>}

      {asking && (
        <div className="weekly-feedback-consent">
          <p className="small">
            기록과 주간 일지 글을 Anthropic(Claude)에 보내 피드백을 만들어요. 이름과 이메일은 보내지 않아요. 설정에서 언제든 끌 수 있어요.
          </p>
          <span className="row-actions">
            <button type="button" disabled={busy} onClick={() => run(true)}>
              동의하고 받기
            </button>
            <button type="button" className="ghost" disabled={busy} onClick={() => setAsking(false)}>
              취소
            </button>
          </span>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
