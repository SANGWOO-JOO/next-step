import { CONDITION_NAMES } from '../api/records'
import c1 from '../assets/conditions/1.svg'
import c2 from '../assets/conditions/2.svg'
import c3 from '../assets/conditions/3.svg'
import c4 from '../assets/conditions/4.svg'
import c5 from '../assets/conditions/5.svg'

const FACES: Record<number, string> = { 1: c1, 2: c2, 3: c3, 4: c4, 5: c5 }


/** 컨디션 얼굴 그림. 스텝이 색 계열 */
export default function ConditionFace({ value, size = 20, className }: { value: number; size?: number; className?: string }) {
  return (
    <img
      className={className ? `condition-face ${className}` : 'condition-face'}
      src={FACES[value]}
      width={size}
      height={size}
      alt={CONDITION_NAMES[value]}
      title={CONDITION_NAMES[value]}
      draggable={false}
    />
  )
}
