# AGENTS.md

Codex 등 다른 코딩 에이전트용 안내. 규칙의 원본은 `CLAUDE.md`이고, 이 파일은 그 요약과 이어받기 안내다.
**먼저 읽을 것:** `CLAUDE.md` → `docs/handoff.md`(지금 상태와 다음 할 일) → `docs/design.md` → `docs/deploy.md`

## 꼭 지킬 것
- 한 단계를 시작하기 전에 범위(엔티티, API, 화면)를 짧게 정리해 사용자 확인을 받는다.
- 설계를 바꾸면 코드보다 먼저 `docs/design.md`(배포는 `docs/deploy.md`)를 고치고 이유를 남긴다.
- 커밋 전에 `cd backend && ./gradlew test`, `cd frontend && npm run build && npm run lint`를 통과시킨다.
- 커밋 메시지는 한국어 `[단계] 설명` 형식(예: `[배포] 운영 설정 추가`). **Co-Authored-By 같은 AI 표시 줄을 넣지 않는다.**
- Flyway 파일 이름 `V{yyyyMMddHHmm}__설명.sql`, 적용된 파일은 수정하지 않는다. SQL은 PostgreSQL과 H2(PostgreSQL 모드) 둘 다에서 돌아야 한다.
- 비밀값(구글 클라이언트 ID와 시크릿, `ANTHROPIC_API_KEY`, AWS 키)은 환경 변수(`~/.zshrc`)나 SSM에만 둔다. 코드, 커밋, 대화에 넣지 않는다. 저장소는 **공개**다.
- 테스트 데이터는 이름 앞에 `[확인용]`을 붙이고 확인 후 지운다. 실제 DB를 지우기 전에는 백업한다.
- push, AWS 리소스 생성, 결제처럼 되돌리기 어렵거나 밖으로 나가는 일은 사용자에게 먼저 묻는다.
- 문서와 화면 문구: AI 티 나는 표현과 가운뎃점(·)을 쓰지 않는다. 단순하고 MVP다운 쪽을 고른다. 결정 전에 웹 조사를 한다.
- 문제를 해결하면 `docs/troubleshooting/`에 `날짜-주제.md`(증상 → 원인 → 해결 → 검증 → 배운 점)로 남기고 README 목록에 더한다.

## 명령어
```bash
docker compose up -d                        # 로컬 DB
cd backend && ./gradlew test                # 백엔드 테스트(테스트 JVM은 Asia/Seoul 고정)
cd backend && ./gradlew bootRun             # :8080
cd frontend && npm run dev                  # :5173, /api는 8080으로 프록시
cd frontend && npm run build && npm run lint
aws sso login --profile next-step           # AWS 작업 전 로그인(항상 --profile next-step)
```
