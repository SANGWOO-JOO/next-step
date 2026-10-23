import { useState } from 'react'
import { actualFromBlock, createActualLog, type UnrecordedBlock } from '../../api/actualLogs'
import asPlannedIcon from '../../assets/icons/as-planned.svg'
import { formatMinutes, minutesOfDay, parseTime, seoulIso } from '../../utils/date'

type Props = {
  date: string
  blocks: UnrecordedBlock[]
  run: (action: () => Promise<unknown>) => Promise<boolean>
}

type Mode = { blockId: number; kind: 'partial' | 'distraction'; value: string }

/** 하루 마무리 "실제 채우기": 기록 없는 지난 계획 블록마다 한 번에 답한다(docs/design.md 1-4e) */
export default function FillActuals({ date, blocks, run }: Props) {
  const [skipped, setSkipped] = useState<number[]>([])
  const [mode, setMode] = useState<Mode | null>(null)
  const left = blocks.filter((b) => !skipped.includes(b.blockId))

  if (left.length === 0) {
    return <p className="muted">채울 칸이 없어요. 다음 단계로 가요.</p>
  }

  const save = async (b: UnrecordedBlock, end: number) => {
    const ok = await run(() =>
      createActualLog({
        date,
        startAt: b.startAt,
        endAt: seoulIso(date, end),
        kind: mode?.kind === 'distraction' ? 'DISTRACTION' : b.dailyGoalId ? 'GOAL' : 'OTHER',
        dailyGoalId: mode?.kind === 'distraction' ? null : b.dailyGoalId,
        categoryId: null,
        title: mode?.kind === 'distraction' ? mode.value.trim() : b.dailyGoalId ? null : b.label,
      }),
    )
    if (ok) setMode(null)
  }

  return (
    <>
      <p className="muted small">계획했는데 기록이 없는 시간이에요. 실제로 어땠는지 골라요.</p>
      <ul className="unfinished-list fill-actuals">
        {left.map((b) => {
          const start = minutesOfDay(b.startAt, date)
          const end = minutesOfDay(b.endAt, date)
          const open = mode?.blockId === b.blockId ? mode : null
          return (
            <li key={b.blockId}>
              <span className="muted small">
                {formatMinutes(start)}–{formatMinutes(end)}
              </span>
              <span>{b.label}</span>
              {open ? (
                <form
                  className="row-actions"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (open.kind === 'partial') {
                      const until = parseTime(open.value)
                      if (until > start && until <= end) save(b, until)
                    } else if (open.value.trim()) {
                      save(b, end)
                    }
                  }}
                >
                  {open.kind === 'partial' ? (
                    <label className="small">
                      몇 시까지?{' '}
                      <input
                        type="time"
                        step={300}
                        value={open.value}
                        onChange={(e) => setMode({ ...open, value: e.target.value })}
                        autoFocus
                      />
                    </label>
                  ) : (
                    <input
                      value={open.value}
                      onChange={(e) => setMode({ ...open, value: e.target.value })}
                      placeholder="대신 한 일 (예: 유튜브)"
                      maxLength={100}
                      autoFocus
                    />
                  )}
                  <button type="submit">저장</button>
                  <button type="button" className="ghost" onClick={() => setMode(null)}>
                    취소
                  </button>
                </form>
              ) : (
                <span className="row-actions">
                  <button className="with-icon" onClick={() => run(() => actualFromBlock(b.blockId))}>
                    <img className="as-planned-icon" src={asPlannedIcon} alt="" aria-hidden="true" width={16} height={16} draggable={false} />
                    계획대로
                  </button>
                  <button
                    className="ghost"
                    onClick={() =>
                      setMode({ blockId: b.blockId, kind: 'partial', value: formatMinutes(start + Math.round((end - start) / 10) * 5) })
                    }
                  >
                    일부만
                  </button>
                  <button className="ghost" onClick={() => setMode({ blockId: b.blockId, kind: 'distraction', value: '' })}>
                    ⚠ 딴짓
                  </button>
                  <button className="ghost" onClick={() => setSkipped([...skipped, b.blockId])}>
                    못 했어요
                  </button>
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
