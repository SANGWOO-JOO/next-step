import { HEALTH_LABELS, type Health } from '../utils/health'

/** 상태 색 점. 순조(초록)·위험(노랑)·달성(파랑)·기간 밖(회색) */
export default function HealthDot({ health, label }: { health: Health; label?: boolean }) {
  return (
    <span className={`health health-${health}`} title={HEALTH_LABELS[health]}>
      <span className="health-dot" />
      {label && HEALTH_LABELS[health]}
    </span>
  )
}
