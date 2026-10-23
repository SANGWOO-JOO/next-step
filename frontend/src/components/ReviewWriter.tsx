import { useCallback, useEffect, useState } from 'react'
import { errorMessage } from '../api/client'
import {
  getMonthlyReview,
  getWeeklyJournal,
  saveMonthlyReview,
  saveWeeklyJournal,
  type MonthlyReview,
  type WeeklyJournal,
} from '../api/reviews'
import { journalDue, reviewDue } from '../pages/plan/planData'
import { currentMonthSeoul, monthLabel, mondayOf, todaySeoul, weekLabel } from '../utils/date'
import { refreshReminders } from '../utils/reminders'
import ReviewCard from './ReviewCard'

/**
 * 기록 페이지 맨 위의 이번 주 일지·이번 달 회고 쓰기(docs/design.md 1-4f ⑳).
 * 계획 화면은 계획 세우기만 하고, 돌아보기는 여기서 쓴다.
 */
export default function ReviewWriter({ kind, onSaved }: { kind: 'week' | 'month'; onSaved: () => void }) {
  const today = todaySeoul()
  const monday = mondayOf(today)
  const month = currentMonthSeoul()
  const [journal, setJournal] = useState<WeeklyJournal | null>(null)
  const [review, setReview] = useState<MonthlyReview | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    const fail = (e: unknown) => setError(errorMessage(e))
    if (kind === 'week') getWeeklyJournal(monday).then(setJournal).catch(fail)
    else getMonthlyReview(month).then(setReview).catch(fail)
  }, [kind, monday, month])
  useEffect(load, [load])

  const save = async (action: () => Promise<unknown>) => {
    setError(null)
    try {
      await action()
      load()
      onSaved()
      refreshReminders()
      return true
    } catch (e) {
      setError(errorMessage(e))
      return false
    }
  }

  return (
    <div className="week-journal" id="journal">
      {error && <p className="error">{error}</p>}
      {kind === 'week' && journal && (
        <ReviewCard
          key={`${monday}|${journal.saved}`}
          title={`이번 주 일지 · ${weekLabel(monday)}`}
          fields={[
            { key: 'good', label: '잘한 점', placeholder: '이번 주에 잘된 것' },
            { key: 'bad', label: '아쉬운 점', placeholder: '막혔던 것, 딴짓한 때' },
            { key: 'nextAction', label: '다음 주 반영', placeholder: '다음 주에 바꿀 한 가지' },
          ]}
          values={{ good: journal.good, bad: journal.bad, nextAction: journal.nextAction }}
          version={`${monday}|${journal.updatedAt}`}
          aiSummary={journal.aiSummary}
          saved={journal.saved}
          due={journalDue(monday, today)}
          prompt={journalDue(monday, today) && !journal.saved ? '한 주를 마무리할 때예요. 돌아보고 다음 주에 바꿀 한 가지를 정해요.' : undefined}
          onSave={(v) => save(() => saveWeeklyJournal(monday, { good: v.good, bad: v.bad, nextAction: v.nextAction }))}
        />
      )}
      {kind === 'month' && review && (
        <ReviewCard
          key={`${month}|${review.saved}`}
          title={`이번 달 회고 · ${monthLabel(month)}`}
          fields={[
            { key: 'review', label: '회고', placeholder: '이번 달에 무엇을 했고 어땠나요?', rows: 4 },
            { key: 'nextDirection', label: '다음 달 방향', placeholder: '다음 달에 집중할 것' },
          ]}
          values={{ review: review.review, nextDirection: review.nextDirection }}
          version={`${month}|${review.updatedAt}`}
          aiSummary={review.aiSummary}
          saved={review.saved}
          due={reviewDue(month, today)}
          prompt={reviewDue(month, today) && !review.saved ? '이 달의 마지막 주예요. 한 달을 돌아보고 다음 달 방향을 정해요.' : undefined}
          onSave={(v) => save(() => saveMonthlyReview(month, { review: v.review, nextDirection: v.nextDirection }))}
        />
      )}
    </div>
  )
}
