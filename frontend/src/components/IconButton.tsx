/** 얇은 원 아이콘 버튼(1-4f ㉛·㉜): 글자 대신 아이콘, 이름은 마우스를 올리면 보이고 화면 읽기 프로그램에도 전달된다 */
export default function IconButton({
  icon,
  label,
  title,
  onClick,
  on,
  disabled,
  pressed,
}: {
  icon: string
  label: string
  title?: string
  onClick: () => void
  on?: boolean
  disabled?: boolean
  /** 켜고 끄는 버튼이면 지금 상태 */
  pressed?: boolean
}) {
  return (
    <button
      type="button"
      className={on ? 'icon-only on' : 'icon-only'}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      title={title ?? label}
    >
      <img src={icon} alt="" aria-hidden="true" width={26} height={26} draggable={false} />
    </button>
  )
}
