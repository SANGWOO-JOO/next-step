import { goalIconUrl } from '../goalIcons'

type Props = {
  /** 목표 아이콘 이름(category.icon). 없으면 색 점 */
  icon?: string | null
  color?: string | null
  size: number
  className?: string
  title?: string
}

/** 목표 아이콘, 없으면 색 점(docs/design.md 11-6 2-7 ③). 분류를 쓰는 화면 어디서나 같은 모양으로 */
export default function GoalIcon({ icon, color, size, className, title }: Props) {
  if (icon) {
    return (
      <img
        className={className ? `goal-icon ${className}` : 'goal-icon'}
        src={goalIconUrl(icon)}
        width={size}
        height={size}
        alt=""
        title={title}
        aria-hidden={title ? undefined : true}
        draggable={false}
      />
    )
  }
  return <span className={className ? `category-dot ${className}` : 'category-dot'} style={{ background: color ?? 'var(--muted)' }} title={title} aria-hidden={title ? undefined : true} />
}
