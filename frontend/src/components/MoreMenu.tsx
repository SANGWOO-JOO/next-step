import { useEffect, useRef, useState } from 'react'

export type MenuItem = {
  label: string
  onClick: () => void
  disabled?: boolean
  title?: string
  danger?: boolean
  /** false면 메뉴에 넣지 않는다 */
  show?: boolean
}

/** ⋯ 버튼을 누르면 펼쳐지는 동작 메뉴. 바깥을 누르거나 Esc를 누르면 닫힌다. */
export default function MoreMenu({ items, label = '더 보기' }: { items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLSpanElement>(null)

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

  return (
    <span className={open ? 'more-menu open' : 'more-menu'} ref={root}>
      <button
        type="button"
        className="icon more-trigger"
        onClick={() => setOpen(!open)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        ⋯
      </button>
      {open && (
        <span className="more-list" role="menu">
          {items
            .filter((i) => i.show !== false)
            .map((i) => (
              <button
                key={i.label}
                type="button"
                role="menuitem"
                className={i.danger ? 'more-item danger' : 'more-item'}
                disabled={i.disabled}
                title={i.title}
                onClick={() => {
                  setOpen(false)
                  i.onClick()
                }}
              >
                {i.label}
              </button>
            ))}
        </span>
      )}
    </span>
  )
}
