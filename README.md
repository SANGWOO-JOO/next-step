# Next Step

공백 말고, 준비 기간. 퇴직 후 이직 준비를 위한 개인 계획·실제 기록·회고 도구.
(저장소·패키지 이름은 job-scheduler 그대로)

- Backend: Kotlin + Spring Boot 3.5 (JPA, Flyway), Java 21
- Frontend: React + TypeScript (Vite)
- DB: PostgreSQL 16 (Docker Compose), 테스트는 H2
- 시간대: Asia/Seoul

## 필요한 것
- JDK 21
- Node.js 20 이상
- Docker Desktop

## 실행
```bash
# 1. DB
docker compose up -d

# 2. 백엔드 (http://localhost:8080)
cd backend
./gradlew bootRun

# 3. 프론트엔드 (http://localhost:5173)
cd frontend
npm install
npm run dev
```

브라우저에서 http://localhost:5173 을 열면 "오늘" 화면에 서버/DB 연결 상태가 표시됩니다.

## 테스트
```bash
cd backend && ./gradlew test
```

## 구조
```
job-scheduler/
├── backend/            # Spring Boot (Kotlin)
│   └── src/main/kotlin/com/jobscheduler
│       ├── category/   # 활동 분류
│       ├── common/     # 공통 예외·에러 응답
│       ├── config/     # CORS 등 설정
│       ├── daily/      # 하루 목표
│       ├── focus/      # 집중 세션·중단·딴생각 메모
│       ├── goal/       # 최종·월간·주간 목표
│       ├── timeblock/  # 시간 블록
│       └── health/     # 연결 확인 API
├── frontend/           # React + TS
│   └── src
│       ├── api/        # API 클라이언트
│       ├── components/ # 공통 레이아웃·컴포넌트
│       ├── pages/      # 화면
│       └── utils/      # 날짜 등 유틸
└── docker-compose.yml  # PostgreSQL
```

## 진행 단계
- [x] 1-0 프로젝트 기본 틀
- [x] 1-1 분류와 목표 구조
- [x] 1-2a 하루 목표
- [x] 1-2b 시간 블록과 집중 모드
- [x] 1-3 기록과 회고
- [x] 1-4 시간 집계와 대시보드 (1-4e 계획 vs 실제 완료, 1-4f 목표 구조 단순화는 2-2 목표 구조 개편으로 대체)
- [ ] 1-5 설정과 텔레그램 봇 (2단계 뒤로 미룸)
- [ ] 2단계 여러 사용자 서비스 "Next Step" (docs/design.md 11장)
  - [x] 2-1 로그인·사용자 분리
  - [x] 2-2 목표 구조 개편
  - [x] 2-3 시작 설정
  - [x] 2-4 랜딩·약관
  - [x] 2-5 목표 아이콘
  - [ ] 2-6 설정 화면 정리
  - [ ] 2-7 목표 아이콘 넓히기
- [ ] 3단계 AI(피드백, 시간 배분 인사이트, 자동 분류) + 자연어 입력
- [ ] 배포(다른 단계를 마친 뒤 맨 마지막)
