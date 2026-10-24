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
  /** 비웠을 때 블록에 보일 이름(목표·할 일 이름). 처음 쓰는 목표의 안내 문구에 쓴다 */
  fallbackName?: string
  /** true면 칸 위에 '세부 내용 (선택)' 이름표를 보인다 */
  showLabel?: boolean
}

const SHOWN = 5

/**
 * 시간 블록 주제 입력(docs/design.md 1-4f ㊽). 같은 분류에서 최근 쓴 주제를 칩으로 보여주고
 * 쓰는 글자로 거른다. 칩으로 고르면 철자가 같아져서 나중에 주제별로 묶인다(Toggl 설명 묶기 참고).
 */
export default function TopicField({ categoryId, value, onChange, onEnter, onEscape, autoFocus, fallbackName, showLabel }: Props) {
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

  // 예시는 그 목표에서 최근 쓴 말로, 없으면 비웠을 때 어떻게 보이는지 알려 준다(NN/g: 칸 이름은 칸 밖 이름표로)
  const placeholder = recent[0]
    ? `예: ${recent[0]}`
    : fallbackName
      ? `비워 두면 '${fallbackName}'로 보여요`
      : '비워 둬도 돼요'

  return (
    <span className="topic-field">
      {showLabel && (
        <span className="topic-label small muted">
          세부 내용 <span className="muted">(선택)</span>
        </span>
      )}
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
        placeholder={placeholder}
        maxLength={100}
        autoFocus={autoFocus}
        aria-label="세부 내용 (선택)"
      />
      {chips.length > 0 && (
        <span className="topic-chips" aria-label="최근 세부 내용">
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
