# CLAUDE.md

퇴직 후 이직 준비용 개인 계획·집중·회고 도구. 전체 설계는 `docs/design.md`를 먼저 읽을 것.

## 스택
- backend: Kotlin + Spring Boot 3.5, Java 21, JPA, Flyway, PostgreSQL 16 (테스트는 H2 PostgreSQL 모드)
- frontend: React 19 + TypeScript + Vite, react-router-dom
- DB는 `docker compose up -d`로 실행. 백엔드/프론트는 로컬에서 직접 실행
- 시간대는 항상 Asia/Seoul

## 명령어
```bash
docker compose up -d                       # DB
cd backend && ./gradlew test               # 백엔드 테스트
cd backend && ./gradlew bootRun            # 백엔드 :8080
cd frontend && npm run dev                 # 프론트 :5173 (/api는 8080으로 프록시)
cd frontend && npm run build && npm run lint
```

## 진행 방식
- 단계는 `docs/design.md` 10장의 순서(1-1 → 1-5)대로, 한 번에 한 단계씩 직렬로 진행한다.
- 한 단계를 시작하기 전에 범위(엔티티, API, 화면)를 짧게 정리해 사용자 확인을 받는다.
- 완료 기준: `./gradlew test` 통과 + `npm run build`, `npm run lint` 통과 + 사용자가 화면에서 확인.
- 단계가 끝나면 README의 진행 단계 체크리스트와 `docs/design.md`의 단계 상태를 갱신한다.
- 설계를 바꾸게 되면 코드보다 먼저 `docs/design.md`를 수정하고 이유를 남긴다.

## 백엔드 규칙
- 패키지는 기능 단위: `com.jobscheduler.<feature>` (예: `goal`, `category`, `focus`, `stats`, `telegram`), 그 안에 `Entity`, `Repository`, `Service`, `Controller`, `dto`.
- 컨트롤러는 엔티티를 직접 반환하지 않고 DTO(data class)를 반환한다.
- 비즈니스 규칙(핵심 하루 목표 최대 3개, 상위 목표 연결, 분류 상속 등)은 Service에 두고 단위 테스트를 작성한다.
- 예외는 `common/Exceptions.kt`의 `NotFoundException`, `BusinessRuleException`을 사용한다. 에러 응답 형식은 `GlobalExceptionHandler`가 통일한다.
- `ddl-auto`는 `validate`. 스키마 변경은 반드시 Flyway 마이그레이션으로 한다.
- Flyway 파일 이름: `V{yyyyMMddHHmm}__설명.sql` (예: `V202610221530__create_category.sql`). 나중에 worktree 병렬 작업을 해도 버전이 겹치지 않게 하기 위함. 이미 적용된 마이그레이션 파일은 수정하지 않는다.
- SQL은 PostgreSQL과 H2(PostgreSQL 모드) 양쪽에서 동작하게 작성한다. PostgreSQL 전용 기능이 필요하면 먼저 알린다.
- 날짜/시간: 날짜는 `LocalDate`, 시각은 `OffsetDateTime`(DB는 `TIMESTAMP WITH TIME ZONE`), 주는 월요일 시작(ISO).
- 비밀값(텔레그램 토큰, LLM API 키)은 환경 변수로만 받는다. 코드와 커밋에 넣지 않는다.

## 프론트엔드 규칙
- API 호출은 `src/api/`에 기능별 파일로 두고 `client.ts`의 `api`를 사용한다.
- 화면은 `src/pages/`, 공통 컴포넌트는 `src/components/`.
- 스타일은 `src/index.css`의 CSS 변수(라이트/다크)를 사용한다.

## Git
- 단계 안에서도 의미 있는 단위로 커밋한다. 메시지는 한국어로 `[1-1] 분류 엔티티와 API 추가` 형식.
- 커밋 전에 테스트와 빌드를 통과시킨다.
