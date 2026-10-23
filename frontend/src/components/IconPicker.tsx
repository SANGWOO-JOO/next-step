import { useEffect, useRef, useState } from 'react'

/** 분류 아이콘 후보(docs/design.md 1-4f ㊻). 취업 준비에 자주 쓰는 것 위주 */
const CATEGORY_ICONS = [
  '📝', '💬', '📘', '💻', '🛠️', '📌',
  '☕', '📚', '🎯', '🗂️', '✉️', '🧠',
  '🏃', '🎧', '🌱', '⭐', '📊', '🤝',
]

type Props = {
  value: string | null
  onChange: (icon: string | null) => void
  label?: string
}

/** 동그란 버튼을 누르면 아이콘 격자가 열리는 작은 고르기 */
export default function IconPicker({ value, onChange, label = '아이콘' }: Props) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  const pick = (icon: string | null) => {
    onChange(icon)
    setOpen(false)
  }

  return (
    <span className="icon-picker" ref={box}>
      <button
        type="button"
        className="icon-picker-button"
        onClick={() => setOpen(!open)}
        aria-label={`${label}: ${value ?? '없음'}`}
        aria-expanded={open}
        title={label}
      >
        {value ?? <span className="muted">＋</span>}
      </button>
      {open && (
        <span className="icon-picker-pop" role="listbox" aria-label={label}>
          {CATEGORY_ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              role="option"
              aria-selected={icon === value}
              className={icon === value ? 'on' : undefined}
              onClick={() => pick(icon)}
            >
              {icon}
            </button>
          ))}
          <button type="button" className="icon-picker-none" onClick={() => pick(null)}>
            없음
          </button>
        </span>
      )}
    </span>
  )
}
