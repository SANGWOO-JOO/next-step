import focusStart from '../assets/focus-start.svg'

/** 집중 시작 아이콘(보라→파랑→하늘 그라데이션 원 + 둥근 재생 삼각형). 글자 크기를 따라 커진다 */
export default function FocusStartIcon({ size = '1.25em' }: { size?: string }) {
  return <img className="focus-start-icon" src={focusStart} alt="" aria-hidden="true" width={size} height={size} draggable={false} />
}
