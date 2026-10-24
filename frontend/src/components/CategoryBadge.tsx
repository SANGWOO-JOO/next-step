type Props = { name: string; color: string; inactive?: boolean }

export default function CategoryBadge({ name, color, inactive }: Props) {
  return (
    <span className={inactive ? 'badge inactive' : 'badge'} title={inactive ? '숨긴 목표' : undefined}>
      <span className="badge-dot" style={{ background: color }} />
      {name}
    </span>
  )
}
