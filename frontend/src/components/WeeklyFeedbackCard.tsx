import { useEffect, useState } from 'react'
import { errorMessage } from '../api/client'
import { agreeAi } from '../api/me'
import { createWeeklyFeedback, getWeeklyJournal, parseFeedback, type AiFeedbackBlock, type WeeklyJournal } from '../api/reviews'
import { useAuth } from '../auth/useAuth'
import WeeklyReviewPanel from './WeeklyReviewPanel'
import { mondayOf, todaySeoul, weekLabel } from '../utils/date'

const BLOCKED: Record<AiFeedbackBlock, string> = {
  UNAVAILABLE: '지금은 쓸 수 없어요',
  NOT_STARTED: '아직 시작하지 않은 주예요',
  NO_JOURNAL: '일지를 쓰면 피드백을 받을 수 있어요',
  TOO_LITTLE: '기록이 1시간 넘게 쌓이면 받을 수 있어요',
  TODAY_DONE: '오늘은 받았어요. 내일 다시 받을 수 있어요',
  LIMIT: '이 주 피드백은 다 받았어요',
}

/**
 * 일지와 같은 주의 AI 피드백(docs/design.md 9-1, 2026-10-26 변경). 진행 중인 주도 받을 수 있다.
 * 버튼을 눌러야 만들고, 처음 한 번 동의를 받는다. 결과는 한 줄 요약, 잘한 점, 해 볼 것.
 */
export default function WeeklyFeedbackCard({ weekStart }: { weekStart: string }) {
  const { me, setMe } = useAuth()
  const [journal, setJournal] = useState<WeeklyJournal | null>(null)
  const [expanded, setExpanded] = useState(false)
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
  const { count, maxCount, blocked } = journal.aiFeedback
  // 진행 중인 주면 "이번 주", 남은 날에 할 것을 제안한다
  const inProgress = weekStart === mondayOf(todaySeoul())
  const nextLabel = inProgress ? '남은 날에 해 볼 것' : '다음 주에 해 볼 것'
  const intro = inProgress ? '이번 주 기록과 일지를 보고 남은 날에 해 볼 것을 알려 줘요.' : '그 주 기록과 일지를 보고 다음 주에 해 볼 것을 알려 줘요.'

  const run = async (agree: boolean) => {
    setBusy(true)
    setError(null)
    try {
      if (agree) setMe(await agreeAi())
      setAsking(false)
      setJournal(await createWeeklyFeedback(weekStart))
      setExpanded(true)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const request = () => (me.aiAgreed ? run(false) : setAsking(true))

  return (
    <WeeklyReviewPanel title={inProgress ? '이번 주 AI 피드백' : 'AI 피드백'} period={weekLabel(weekStart)} kind="feedback" expanded={expanded} onCollapse={() => { setExpanded(false); setAsking(false) }}>
      {!expanded && <>
        <p className="weekly-review-preview">{feedback ? feedback.summary : blocked ? BLOCKED[blocked] : intro}</p>
        <footer className="weekly-review-actions"><span className="muted small">{feedback ? '피드백 도착' : '아직 받은 피드백이 없어요'}</span><button type="button" aria-expanded={false} disabled={!feedback && (busy || blocked !== null)} onClick={() => { setExpanded(true); if (!feedback) request() }}>{feedback ? '피드백 보기' : '피드백 받기'}</button></footer>
      </>}
      <div className="weekly-review-content weekly-feedback" hidden={!expanded}>
      {feedback ? (
        <div className="weekly-feedback-body">
          <p className="weekly-feedback-summary">{feedback.summary}</p>
          <dl>
            <dt>잘한 점</dt>
            <dd>{feedback.good}</dd>
            <dt>{nextLabel}</dt>
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
        !asking && <p className="muted small">{blocked ? BLOCKED[blocked] : intro}</p>
      )}
      {feedback && blocked && blocked !== 'TOO_LITTLE' && <p className="muted small">{BLOCKED[blocked]}</p>}
      {feedback && blocked !== 'LIMIT' && count > 0 && <p className="muted small">이 주에 {maxCount - count}번 더 받을 수 있어요(하루 1번)</p>}

      {!asking && <footer className="weekly-review-actions">
        {blocked !== 'LIMIT' && <button type="button" className={feedback ? 'ghost' : undefined} disabled={busy || blocked !== null} onClick={request}>{busy ? '만드는 중…' : feedback ? '한 번 더 받기' : '피드백 받기'}</button>}
      </footer>}

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
    </WeeklyReviewPanel>
  )
}
