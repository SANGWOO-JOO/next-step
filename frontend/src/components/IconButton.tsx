/**
 * 얇은 원 아이콘 버튼(1-4f ㉛·㉜): 글자 대신 아이콘, 이름은 마우스를 올리면 보이고 화면 읽기 프로그램에도 전달된다.
 * 설명은 브라우저 기본 툴팁 대신 앱 공통 툴팁(data-tip)으로 보여 준다(계획만·실제만 버튼과 같게)
 */
export default function IconButton({
  icon,
  label,
  title,
  onClick,
  on,
  disabled,
  pressed,
  tipAlign,
}: {
  icon: string
  label: string
  title?: string
  onClick: () => void
  on?: boolean
  disabled?: boolean
  /** 켜고 끄는 버튼이면 지금 상태 */
  pressed?: boolean
  /** 화면 오른쪽 끝 버튼이면 'right': 툴팁이 오른쪽으로 넘치지 않게 */
  tipAlign?: 'right'
}) {
  return (
    <button
      type="button"
      className={[on ? 'icon-only on' : 'icon-only', tipAlign === 'right' ? 'tip-right' : ''].filter(Boolean).join(' ')}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      data-tip={title ?? label}
    >
      <img src={icon} alt="" aria-hidden="true" width={26} height={26} draggable={false} />
    </button>
  )
}
