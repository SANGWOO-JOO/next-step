import { useCallback, useEffect, useState } from 'react'
import { getCategories, type Category } from '../../api/categories'
import { errorMessage } from '../../api/client'
import { getDailyGoalsBetween, type DailyGoal } from '../../api/dailyGoals'
import { getDailyLog, getManualLogs, type DailyLog, type ManualStudyLog } from '../../api/records'
import { getTimeBlocksBetween, type TimeBlock } from '../../api/timeBlocks'
import { minutesOfDay } from '../../utils/date'
import { refreshReminders } from '../../utils/reminders'
import ShutdownDialog from './ShutdownDialog'

/**
 * 아무 날짜의 하루 마무리 창(docs/design.md 1-4f ㉑). 그날 데이터를 직접 불러와서
 * 일정 화면·기록 페이지 어디서 열어도 같은 창이 뜬다.
 */
export default function DayWrapUp({ date, onClose }: { date: string; onClose: () => void }) {
  const [data, setData] = useState<{
    log: DailyLog
    goals: DailyGoal[]
    manualLogs: ManualStudyLog[]
    categories: Category[]
    blocks: TimeBlock[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    () =>
      Promise.all([getDailyLog(date), getDailyGoalsBetween(date, date), getManualLogs(date), getCategories(), getTimeBlocksBetween(date, date)])
        .then(([log, goals, manualLogs, categories, blocks]) => setData({ log, goals, manualLogs, categories, blocks }))
        .catch((e) => setError(errorMessage(e))),
    [date],
  )
  useEffect(() => {
    load()
  }, [load])

  const run = async (action: () => Promise<unknown>) => {
    setError(null)
    try {
      await action()
      return true
    } catch (e) {
      setError(errorMessage(e))
      return false
    } finally {
      await load()
    }
  }

  if (error && !data) return <p className="error-banner">{error}</p>
  if (!data) return null

  return (
    <ShutdownDialog
      date={date}
      log={data.log}
      goals={data.goals}
      manualLogs={data.manualLogs}
      categories={data.categories}
      plannedMinutes={data.blocks.reduce((sum, b) => sum + minutesOfDay(b.endAt, date) - minutesOfDay(b.startAt, date), 0)}
      run={run}
      onClose={() => {
        refreshReminders()
        onClose()
      }}
    />
  )
}
