# 이어받기 메모 (2026-10-25 기준)

다른 에이전트나 다음 세션이 바로 이어서 작업할 수 있게 지금 상태를 적는다. 새 작업을 끝내면 이 파일도 고친다.

## 프로젝트
- **Next Step**: 취업 준비생과 이직 준비생을 위한 공부 계획, 기록, 돌아보기 도구(여러 사용자).
- 저장소: https://github.com/SANGWOO-JOO/next-step (공개, MIT, Secret Scanning과 Push Protection 켜짐)
- 스택: Kotlin Spring Boot 3.5(Java 21, JPA, Flyway, PostgreSQL 16), React 19 + Vite + TS
- 인증: 구글 로그인 + 서버 세션(Spring Session JDBC, PostgreSQL 저장), CSRF는 쿠키 방식. JWT는 쓰지 않는다(`docs/deploy.md` 4장).

## 끝난 단계
- 기능: 1단계(1-1 ~ 1-5), 2단계(2-1 ~ 2-9), 3단계(AI 주간 피드백, Claude Haiku 5.5) 모두 완료. 자세한 내용은 `docs/design.md` 10장과 README 체크리스트.
- 배포 준비(`docs/deploy.md` 9장)
  - 0 인덱스, 1 세션과 CSRF, 2 공개 저장소, 3 `ci.yml`, 4 `release.yml`(태그 `v*` → 검사 → jar와 웹 zip → GitHub Release, 배포 단계는 아직 꺼짐), 5 운영 설정(`application-prod.yml`, `deploy/docker-compose.prod.yml`, `deploy/backup.sh`) 완료
- 트러블 슈팅 기록 6건: `docs/troubleshooting/README.md`

## 지금 하는 일: 배포 6단계(AWS 인프라)
**AWS 계정 준비는 끝났다.** (계정 번호, 포털 주소 같은 구체 값은 공개 저장소에 두지 않고 로컬 `docs/handoff.private.md`에 있다. git에 올라가지 않는다.)
- 루트 MFA(패스키), 월 $25 예산 알림, IAM Identity Center 작업용 관리자(AdministratorAccess), CLI 프로필 `next-step`(SSO)
- 이 계정은 AWS Organizations 관리 계정이고, next-step 리소스도 이 계정에 둔다(사용자 결정, 단순함 우선).

**다음 할 일(순서대로)**
1. **도메인 고르기와 구입**: Route 53에서 살 수 있는 후보 `nextstep-plan.com`($16/년, 추천), `nextstep-log.com`, `studynextstep.com`, `nextstep-study.app`($20). 사용자가 아직 고르지 않았다. 구입(결제)은 사용자가 직접 한다.
2. **6단계 범위**(이미 사용자와 합의함): CloudFormation 템플릿 `deploy/infra.yml` 하나(+ 버지니아 리전 ACM 인증서용 작은 템플릿)로 아래를 만든다.
   - Route 53 호스팅 영역, ACM 인증서(us-east-1)
   - S3 웹 버킷(비공개) + CloudFront OAC. CloudFront 하나에서 `/`는 S3(캐시), `/api/*`, `/oauth2/*`, `/login/oauth2/*`, `/logout`은 EC2(캐시 없음, 쿠키 전달, 오리진 요청 정책에 `CloudFront-Forwarded-Proto` 포함). 화면 주소 새로고침은 CloudFront Function으로 `index.html`
   - EC2 t4g.small(Amazon Linux 2023, ARM), EBS gp3 20GB, 고정 IP, 보안 그룹은 CloudFront 관리형 접두사 목록만 허용(SSH 없음, SSM으로 접속)
   - EC2 역할(SSM 파라미터 읽기, 백업 S3 쓰기, 릴리즈 jar 읽기, CloudWatch), 백업 S3 버킷(7일 수명 주기)
   - SSM Parameter Store(SecureString): DB 비밀번호(서버에서 무작위 생성), 구글 ID와 시크릿, Anthropic 키(사용자가 직접 넣는다)
   - GitHub OIDC 역할(이 저장소 태그만, S3 업로드, CloudFront 무효화, SSM 명령)
   - CloudWatch 에이전트와 경보 6개(`docs/deploy.md` 6장), SNS 이메일
   - 서버 준비: Docker, Compose, `deploy` 폴더, SSM 값으로 `.env` 만들기, 백업 cron
   - 마치는 기준: 도메인 접속 시 S3 빈 페이지, SSM으로 서버 접속해 `docker compose version`, 백업 한 번 손으로 성공, 경보 메일 구독 확인
   - **EC2를 만들면 요금이 나간다(월 약 $21).** 만들기 전에 사용자 확인을 받고, 6단계 뒤 7, 8단계를 바로 잇는다.
3. 7단계: 구글 OAuth 운영 주소 등록과 프로덕션 게시, 운영용 Anthropic 키(사용자 작업 포함)
4. 8단계: `release.yml` 배포 단계 켜기, 첫 배포 `v0.1.0`, 실제 구글 로그인과 재시작 후 로그인 유지 확인, 백업 복구 연습

## 미뤄 둔 것
- 루트 계정에 휴대폰 인증 앱을 두 번째 MFA로 추가
- 예전 IAM 사용자 `sangwoo-cli`의 오래 가는 액세스 키 비활성화(다른 곳에서 쓰는지 사용자 확인 필요), 예전 예산 `monthly-cost-guard`($100) 정리
- 마스코트 다시 그리기(`docs/brand/mascot-brief/`는 로컬 전용, git 제외), 일요일 이메일과 웹 푸시(배포 뒤)

## 알아 둘 함정
- 테스트는 `main()`을 거치지 않아 시간대가 늦게 정해진다. 테스트 JVM은 `build.gradle.kts`에서 Asia/Seoul로 고정했다(`docs/troubleshooting/2026-10-25-ci-timezone.md`).
- Spring Session은 JPA가 아닌 순수 JDBC 트랜잭션 매니저를 써야 한다(멀티테넌시와 무한 반복, `docs/troubleshooting/2026-10-25-spring-session-login.md`).
- 운영 Compose는 필수 값이 비면 켜지지 않는다(`:?`). 로컬은 HTTPS가 아니라 Secure 쿠키 때문에 운영 설정으로 로그인 확인을 할 수 없다.
- 루트 콘솔 로그인은 패스키가 있는 Safari에서만 된다. 평소 AWS 작업은 액세스 포털의 `sangwoo` 계정으로 한다.
