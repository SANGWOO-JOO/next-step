import { useCallback, useEffect, useState } from 'react'
import { errorMessage } from '../api/client'
import { getWeeklyJournal, saveWeeklyJournal, type WeeklyJournal } from '../api/reviews'
import { journalDue } from '../pages/plan/planData'
import { mondayOf, shiftDate, todaySeoul, weekLabel } from '../utils/date'
import { refreshReminders } from '../utils/reminders'
import ReviewCard from './ReviewCard'
import WeeklyFeedbackCard from './WeeklyFeedbackCard'

/**
 * 회고 화면 맨 위 이번 주 카드(docs/design.md 11-6 2-9 ②): 왼쪽 이번 주 일지, 오른쪽 지난 주 AI 피드백.
 * 월간 회고는 화면에서 뺐다(2-9 ⑤).
 */
export default function ReviewWriter({ onSaved }: { onSaved: () => void }) {
  const today = todaySeoul()
  const monday = mondayOf(today)
  const [journal, setJournal] = useState<WeeklyJournal | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    getWeeklyJournal(monday)
      .then(setJournal)
      .catch((e) => setError(errorMessage(e)))
  }, [monday])
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
    <div className="log-week" id="journal">
      {error && <p className="error">{error}</p>}
      {journal && (
        <ReviewCard
          key={`${monday}|${journal.saved}`}
          title="이번 주 일지"
          period={weekLabel(monday)}
          fields={[
            { key: 'good', label: '잘한 점', placeholder: '이번 주에 잘된 것' },
            { key: 'bad', label: '아쉬운 점', placeholder: '막혔던 것, 딴짓한 때' },
            { key: 'nextAction', label: '다음 주에 바꿀 한 가지', placeholder: '다음 주에 바꿀 한 가지' },
          ]}
          values={{ good: journal.good, bad: journal.bad, nextAction: journal.nextAction }}
          version={`${monday}|${journal.updatedAt}`}
          aiSummary={null}
          saved={journal.saved}
          due={journalDue(monday, today)}
          prompt={journalDue(monday, today) && !journal.saved ? '한 주를 마무리할 때예요. 돌아보고 다음 주에 바꿀 한 가지를 정해요.' : undefined}
          onSave={(v) => save(() => saveWeeklyJournal(monday, { good: v.good, bad: v.bad, nextAction: v.nextAction }))}
        />
      )}
      <WeeklyFeedbackCard weekStart={shiftDate(monday, -7)} />
    </div>
  )
}
