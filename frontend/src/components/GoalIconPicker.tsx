import { useEffect, useRef, useState } from 'react'
import { GOAL_ICON_GROUPS, goalIconLabel, goalIconUrl, suggestGoalIcons } from '../goalIcons'

type Props = {
  /** 지금 아이콘. null이면 기본 아이콘 */
  value: string | null
  /** 추천을 고르는 데 쓰는 목표 이름 */
  title: string
  onChange: (name: string) => void
}

/**
 * 목표 이름 왼쪽의 아이콘 칸(docs/design.md 11-6 2-5 ④, 시안 A).
 * 누르면 묶음 탭, 추천, 묶음별 전체가 있는 고르기 창이 열린다. 바깥을 누르거나 Esc를 누르면 닫힌다.
 */
export default function GoalIconPicker({ value, title, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const suggested = suggestGoalIcons(title).slice(0, 6)
  const sections = [...(suggested.length ? [{ label: '추천', names: suggested }] : []), ...GOAL_ICON_GROUPS.map((g) => ({ label: g.label, names: g.icons.map((i) => i.name) }))]

  const jump = (label: string) => list.current?.querySelector(`[data-group="${label}"]`)?.scrollIntoView({ block: 'start' })

  const choose = (name: string) => {
    onChange(name)
    setOpen(false)
  }

  return (
    <div className="goal-icon-picker" ref={root}>
      <button
        type="button"
        className={open ? 'goal-icon-trigger open' : 'goal-icon-trigger'}
        onClick={() => setOpen(!open)}
        aria-label={`아이콘: ${goalIconLabel(value)}. 바꾸기`}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-tip="아이콘 바꾸기"
      >
        <img src={goalIconUrl(value)} alt="" />
      </button>
      {open && (
        <div className="goal-icon-pop card" role="dialog" aria-label="아이콘 고르기">
          <div className="goal-icon-tabs">
            {GOAL_ICON_GROUPS.map((g) => (
              <button key={g.label} type="button" onClick={() => jump(g.label)} aria-label={g.label} data-tip={g.label}>
                <img src={goalIconUrl(g.icons[0].name)} alt="" />
              </button>
            ))}
          </div>
          <div className="goal-icon-list" ref={list}>
            {sections.map((s) => (
              <section key={s.label} data-group={s.label}>
                <div className="goal-icon-cap">{s.label}</div>
                <div className="goal-icon-grid">
                  {s.names.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={n === value ? 'on' : undefined}
                      aria-pressed={n === value}
                      aria-label={goalIconLabel(n)}
                      title={goalIconLabel(n)}
                      onClick={() => choose(n)}
                    >
                      <img src={goalIconUrl(n)} alt="" />
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
