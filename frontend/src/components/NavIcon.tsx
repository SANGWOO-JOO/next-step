import brand from '../assets/nav/brand.svg'
import checklist from '../assets/nav/checklist.svg'
import collapse from '../assets/nav/collapse.svg'
import dashboard from '../assets/nav/dashboard.svg'
import expand from '../assets/nav/expand.svg'
import log from '../assets/nav/log.svg'
import plan from '../assets/nav/plan.svg'
import schedule from '../assets/nav/schedule.svg'
import settings from '../assets/nav/settings.svg'

/** 메뉴는 그라데이션 아이콘 타일 이미지(1-4f ⑱, 알림 카드와 같은 스타일). 모바일 메뉴 버튼만 선 아이콘 */
const IMAGES: Record<string, string> = { brand, schedule, plan, log, dashboard, checklist, settings, collapse, expand }

/** 메뉴 아이콘(선 아이콘, 24 격자). 색은 글자색을 따른다 */
const PATHS: Record<string, string> = {
  schedule: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM16 3v4M8 3v4M4 11h16M8 15h2v2H8z',
  focus: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM10 8.5v7l6-3.5z',
  plan: 'M12 12m-1 0a1 1 0 1 0 2 0 1 1 0 1 0-2 0M12 7a5 5 0 1 0 5 5M13 3.06A9 9 0 1 0 20.94 11M15 6v3h3l3-3h-3V3z',
  log: 'M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM9 4v16M13 8h2M13 12h2',
  dashboard: 'M3 13a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM10 9a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1zM17 5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1z',
  checklist: 'M9.5 6.5l1.5 1.5 2.5-2.5M9.5 12.5l1.5 1.5 2.5-2.5M9.5 18.5l1.5 1.5 2.5-2.5M16 7h4M16 13h4M16 19h4M4 6h2M4 12h2M4 18h2',
  settings:
    'M10.3 4.3c.4-1.8 3-1.8 3.4 0a1.7 1.7 0 0 0 2.6 1.1c1.5-.9 3.3.8 2.4 2.4a1.7 1.7 0 0 0 1 2.5c1.8.4 1.8 3 0 3.4a1.7 1.7 0 0 0-1 2.6c.9 1.5-.9 3.3-2.4 2.4a1.7 1.7 0 0 0-2.6 1c-.4 1.8-3 1.8-3.4 0a1.7 1.7 0 0 0-2.6-1c-1.5.9-3.3-.9-2.4-2.4a1.7 1.7 0 0 0-1-2.6c-1.8-.4-1.8-3 0-3.4a1.7 1.7 0 0 0 1-2.5c-.9-1.6.9-3.3 2.4-2.4 1 .6 2.3.1 2.6-1.1zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  collapse: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM9 4v16M15 10l-2 2 2 2',
  expand: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM9 4v16M14 10l2 2-2 2',
  menu: 'M4 6h16M4 12h16M4 18h16',
}

export default function NavIcon({ name }: { name: keyof typeof PATHS | string }) {
  if (IMAGES[name]) {
    return <img className="nav-icon nav-tile" src={IMAGES[name]} alt="" aria-hidden="true" width={22} height={22} draggable={false} />
  }
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
