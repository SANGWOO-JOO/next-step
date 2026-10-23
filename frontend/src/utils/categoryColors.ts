/**
 * 새 분류 색 고르기(docs/design.md 1-4f ㊷). 색 코드가 아니라 색 계열(색상환 각도)로 비교해서
 * 이미 쓰는 계열과 가까운 색은 빼고 남은 후보만 돌려준다.
 */
const PALETTE = [
  '#14b8a6', // 청록
  '#ec4899', // 핑크
  '#eab308', // 노랑
  '#06b6d4', // 하늘
  '#84cc16', // 연두
  '#f43f5e', // 장미
  '#3b82f6', // 파랑
  '#ef4444', // 빨강
  '#22c55e', // 초록
  '#8b5cf6', // 보라
  '#f97316', // 주황
  '#6366f1', // 남색
  '#d946ef', // 자홍
  '#a16207', // 갈색
  '#64748b', // 회색
]

/** 이 각도 안이면 같은 계열로 본다 */
const SAME_HUE = 22

type Hsl = { h: number; s: number; l: number }

function toHsl(hex: string): Hsl {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l }
  const s = d / (1 - Math.abs(2 * l - 1))
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: (h * 60 + 360) % 360, s, l }
}

const isGray = (c: Hsl) => c.s < 0.2

function similar(a: string, b: string) {
  const x = toHsl(a)
  const y = toHsl(b)
  if (isGray(x) || isGray(y)) return isGray(x) && isGray(y)
  const diff = Math.abs(x.h - y.h)
  return Math.min(diff, 360 - diff) < SAME_HUE
}

/** 쓰는 색과 계열이 겹치지 않는 후보. 다 겹치면 전체 팔레트 */
export function availableColors(usedColors: string[]): string[] {
  const free = PALETTE.filter((c) => !usedColors.some((u) => similar(c, u)))
  return free.length > 0 ? free : PALETTE
}
