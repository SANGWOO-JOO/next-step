/**
 * 목표 아이콘(docs/design.md 11-6 2-5). 이름은 서버 GoalIcons.NAMES와 같다.
 * 자동 고르기는 키워드 규칙: 목표 이름에 들어 있는 키워드가 길수록 점수가 높다.
 */
const urls = import.meta.glob<string>('./assets/goal-icons/*.svg', { eager: true, query: '?url', import: 'default' })

export type GoalIconDef = { name: string; label: string; keywords: string[] }
export type GoalIconGroup = { label: string; icons: GoalIconDef[] }

const icon = (name: string, label: string, keywords: string) => ({ name, label, keywords: keywords.split(',') })

export const GOAL_ICON_GROUPS: GoalIconGroup[] = [
  {
    label: '지원 서류',
    icons: [
      icon('resume', '이력서', '이력서,resume,cv'),
      icon('cover-letter', '자기소개서', '자기소개서,자소서,자기소개'),
      icon('career-record', '경력기술서', '경력기술서,경력기술,경력 정리,성과 정리,성과정리,경력정리'),
      icon('portfolio', '포트폴리오', '포트폴리오,포폴,portfolio'),
      icon('apply', '채용 지원', '지원,공채,서류,입사,취업,취직,합격,채용'),
      icon('job-post', '공고 분석', '공고,jd,직무기술서'),
      icon('company', '기업 분석', '기업 분석,기업분석,회사 조사,회사조사,기업 조사,산업 분석'),
      icon('profile-card', '프로필 정리', '링크드인,linkedin,원티드,리멤버,프로필,명함'),
    ],
  },
  {
    label: '시험과 면접',
    icons: [
      icon('interview', '인성 면접', '면접,인성,자기소개 연습,1분 자기소개'),
      icon('tech-interview', '기술 면접', '기술 면접,기술면접,cs면접,cs,운영체제,네트워크,데이터베이스,전공 면접'),
      icon('mock-interview', '모의 면접', '모의 면접,모의면접,면접 연습,면접 스터디'),
      icon('presentation', 'PT 면접', 'pt면접,pt 준비,발표,프레젠테이션'),
      icon('coding-test', '코딩 테스트', '코딩 테스트,코딩테스트,코테,백준,프로그래머스,리트코드,leetcode,swea'),
      icon('algorithm', '알고리즘', '알고리즘,자료구조'),
      icon('aptitude', '인적성', '인적성,적성,gsat,skct,lg way,싸피 적성,잡코리아 적성'),
      icon('ncs-public', 'NCS 공기업', 'ncs,공기업,공공기관,공무원,psat,전공 필기'),
      icon('assignment', '과제 전형', '과제,사전 과제,과제 전형'),
    ],
  },
  {
    label: '자격증과 어학',
    icons: [
      icon('certificate', '자격증', '자격증,기사,sqld,sqlp,adsp,컴활,컴퓨터활용,aws,정처기,산업기사,cpa,세무사,노무사'),
      icon('korean-history', '한국사', '한국사,한능검'),
      icon('english-test', '영어 시험', '토익,toeic,토플,toefl,텝스,teps,아이엘츠,ielts,영어'),
      icon('english-speaking', '영어 회화', '회화,오픽,opic,토스,토익스피킹,스피킹,speaking'),
      icon('japanese', '일본어', '일본어,jlpt,jpt'),
      icon('chinese', '중국어', '중국어,hsk'),
      icon('language-globe', '그 밖의 외국어', '외국어,스페인어,독일어,프랑스어,베트남어,어학'),
      icon('exam-date', '시험 일정', '시험,접수,d-'),
    ],
  },
  {
    label: '직무 공부',
    icons: [
      icon('dev-laptop', '개발', '개발,코딩,프로그래밍,스프링,spring,리액트,react,자바,java,파이썬,python,코틀린,kotlin,백엔드,프론트,서버,앱 개발,ios,안드로이드'),
      icon('project-rocket', '개인 프로젝트', '프로젝트,사이드,출시,런칭,mvp'),
      icon('github-grass', '깃허브', '깃허브,github,잔디,오픈소스,커밋'),
      icon('data-chart', '데이터 분석', '데이터,분석,sql,통계,태블로,엑셀 분석'),
      icon('ai-chip', 'AI', 'ai,인공지능,머신러닝,딥러닝,llm,프롬프트,gpt'),
      icon('design-palette', '디자인', '디자인,피그마,figma,ui디자인,ux,포토샵,일러스트'),
      icon('planning-board', '기획', '기획,pm,서비스 기획,요구사항'),
      icon('marketing-megaphone', '마케팅', '마케팅,광고,그로스,브랜딩,sns'),
      icon('business-calc', '경영 사무', '회계,재무,경영,사무,엑셀,전산회계'),
      icon('video-clapper', '영상 콘텐츠', '영상,유튜브,편집,콘텐츠'),
      icon('online-course', '온라인 강의', '강의,인강,완강,부트캠프,강좌,수업,클래스'),
      icon('reading-book', '독서', '책,독서,읽기,도서'),
    ],
  },
  {
    label: '경험 쌓기',
    icons: [
      icon('intern-badge', '인턴', '인턴,인턴십,현장실습'),
      icon('activity-flag', '대외활동', '대외활동,서포터즈,동아리,봉사,기자단'),
      icon('contest-trophy', '공모전', '공모전,해커톤,대회,경진'),
      icon('study-group', '스터디', '스터디,모임'),
      icon('blog-note', '기록 블로그', '블로그,til,회고,기록,글쓰기,벨로그,티스토리'),
    ],
  },
  {
    label: '이직 준비',
    icons: [
      icon('career-compass', '커리어 방향', '이직,커리어,진로,방향,직무 전환,전직'),
      icon('networking-handshake', '네트워킹', '네트워킹,커피챗,현직자,헤드헌터,인맥,멘토'),
      icon('reputation-stars', '평판 관리', '레퍼런스,평판,추천인'),
      icon('salary-coins', '연봉 협상', '연봉,처우,협상,저축,돈'),
      icon('resign-box', '퇴사 인수인계', '퇴사,인수인계,사직'),
    ],
  },
  {
    label: '생활과 컨디션',
    icons: [
      icon('exercise-dumbbell', '운동', '운동,헬스,러닝,달리기,요가,필라테스,수영,걷기'),
      icon('routine-sunmoon', '생활 리듬', '기상,수면,루틴,아침,미라클모닝,출근 전,퇴근 후,생활'),
      icon('mind-heart', '마음 관리', '명상,멘탈,마음,휴식,쉬기,감사'),
    ],
  },
]

const ALL = GOAL_ICON_GROUPS.flatMap((g) => g.icons)
const compact = (s: string) => s.toLowerCase().replace(/\s+/g, '')

/** 아이콘 그림 주소. 이름이 없거나 모르는 이름이면 기본 아이콘(스텝이 얼굴) */
export const goalIconUrl = (name: string | null | undefined) =>
  urls[`./assets/goal-icons/${name}.svg`] ?? urls['./assets/goal-icons/default.svg']

export const goalIconLabel = (name: string | null | undefined) => ALL.find((i) => i.name === name)?.label ?? '기본'

/** 목표 이름과 어울리는 아이콘을 점수 순으로. 맞는 키워드가 없으면 빈 목록 */
export function suggestGoalIcons(title: string): string[] {
  const t = compact(title)
  if (!t) return []
  return ALL.map((i, order) => ({
    name: i.name,
    order,
    score: Math.max(0, ...i.keywords.map((k) => (t.includes(compact(k)) ? compact(k).length : 0))),
  }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((s) => s.name)
}

/** 자동으로 붙일 아이콘. 맞는 게 없으면 null(기본 아이콘) */
export const autoGoalIcon = (title: string) => suggestGoalIcons(title)[0] ?? null
