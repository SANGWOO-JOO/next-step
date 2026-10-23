import { HEALTH_LABELS, type Health } from '../utils/health'

/** 마우스를 올리면 보이는 설명(1-4f: 글자 대신 색 점만 보여줌) */
const HEALTH_HINTS: Record<Health, string> = {
  done: '목표를 달성했어요',
  on: '지난 기간만큼 진행하고 있어요',
  risk: '지난 기간보다 진행이 늦어요',
  idle: '아직 시작 전이거나 끝난 기간이에요',
}

/** 상태 색 점. 순조(초록)·위험(노랑)·달성(파랑)·기간 밖(회색) */
export default function HealthDot({ health, label }: { health: Health; label?: boolean }) {
  return (
    <span className={`health health-${health}`} title={`${HEALTH_LABELS[health]}: ${HEALTH_HINTS[health]}`}>
      <span className="health-dot" />
      {label && HEALTH_LABELS[health]}
    </span>
  )
}
