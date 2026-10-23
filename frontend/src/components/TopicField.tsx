import { useEffect, useState } from 'react'
import { getTopics } from '../api/timeBlocks'

type Props = {
  /** 이 분류에서 최근 쓴 주제를 칩으로 보여준다. 없으면 칩 없이 입력칸만 */
  categoryId: number | null
  value: string
  onChange: (value: string) => void
  /** Enter 또는 칩을 누르면 그 값으로 부른다 */
  onEnter?: (value: string) => void
  onEscape?: () => void
  autoFocus?: boolean
}

const SHOWN = 5

/**
 * 시간 블록 주제 입력(docs/design.md 1-4f ㊽). 같은 분류에서 최근 쓴 주제를 칩으로 보여주고
 * 쓰는 글자로 거른다. 칩으로 고르면 철자가 같아져서 나중에 주제별로 묶인다(Toggl 설명 묶기 참고).
 */
export default function TopicField({ categoryId, value, onChange, onEnter, onEscape, autoFocus }: Props) {
  const [recent, setRecent] = useState<string[]>([])

  useEffect(() => {
    if (categoryId === null) return
    let cancelled = false
    getTopics(categoryId)
      .then((topics) => !cancelled && setRecent(topics))
      .catch(() => !cancelled && setRecent([]))
    return () => {
      cancelled = true
    }
  }, [categoryId])

  const q = value.trim().toLowerCase()
  const chips = (categoryId === null ? [] : recent)
    .filter((t) => t.toLowerCase() !== q && (!q || t.toLowerCase().includes(q)))
    .slice(0, SHOWN)

  return (
    <span className="topic-field">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return
          if (e.key === 'Enter' && onEnter) {
            e.preventDefault()
            onEnter(value)
          } else if (e.key === 'Escape' && onEscape) {
            e.preventDefault()
            onEscape()
          }
        }}
        placeholder="무엇을? (예: 데이터 통신)"
        maxLength={100}
        autoFocus={autoFocus}
        aria-label="주제"
      />
      {chips.length > 0 && (
        <span className="topic-chips" aria-label="최근 주제">
          {chips.map((t) => (
            <button
              key={t}
              type="button"
              className="topic-chip"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => (onEnter ? onEnter(t) : onChange(t))}
            >
              {t}
            </button>
          ))}
        </span>
      )}
    </span>
  )
}
