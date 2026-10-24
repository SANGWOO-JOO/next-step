# Next Step 인프라와 배포 설계

기능 설계는 `docs/design.md`, 여기는 인프라와 배포만 다룬다. 결정을 바꾸면 이 문서를 먼저 고치고 이유를 남긴다.
작성 2026-10-25. 상태: 설계 중(아직 배포하지 않음).

## 1. 원칙
- MVP 규모(사용자 수천 명 이하)에 맞춰 **서버 한 대, 관리할 것 최소**로 시작한다.
- 지금 로컬 구조(Spring Boot 하나, PostgreSQL 하나, React 정적 빌드, Vite 프록시)를 거의 그대로 올린다.
- 비밀값은 코드와 저장소 밖(SSM)에만 둔다. 저장소는 공개를 전제로 한다.
- 늘릴 때의 기준(10장)을 미리 정해 두고, 그 전에는 더하지 않는다.

## 2. 구조

```
사용자 브라우저
  │ https://(도메인)
  ▼
CloudFront (HTTPS, ACM 인증서, 도메인 하나)
  ├─ /                                   → S3 (React 빌드)
  └─ /api, /oauth2, /login/oauth2, /logout → EC2 t4g.small (서울)
                                              └─ Docker Compose
                                                  ├─ Spring Boot (Java 21, jar)
                                                  └─ PostgreSQL 16 (EBS gp3 20GB)
                                                        │ 매일 pg_dump
                                                        ▼
                                                     S3 백업 (7일)
Spring Boot → Google OAuth (로그인 확인), Anthropic Claude (주간 피드백)
운영: SSM Parameter Store(비밀값), CloudWatch(지표, 경보, 로그), Route 53(도메인)
```

- 도메인 하나로 묶는 이유: 프론트와 API가 같은 출처라 세션 쿠키(SameSite=Lax), CSRF 쿠키, CORS 문제가 없다. 로컬의 Vite 프록시와 같은 구조다.
- CloudFront에서 EC2로 가는 경로는 캐시하지 않고(쿠키, 헤더, 쿼리 전달), `/`만 캐시한다.
- EC2 보안 그룹은 CloudFront에서 오는 HTTP만 연다(CloudFront 관리형 접두사 목록). SSH(22)는 열지 않고 SSM Session Manager로 접속한다.
- 24시간 운영(2026-10-25 결정). 9~18시만 켜는 안은 사용자가 저녁과 주말에 공부해서 맞지 않음.

### 고려했지만 뺀 것
| 안 | 이유 |
|---|---|
| RDS | db.t4g.small 서울이 월 약 $37로 전체 비용이 두 배 이상. EC2 안 Postgres + 매일 S3 백업으로 시작 |
| ECS Fargate + ALB | ALB와 Fargate 고정비가 MVP 대비 큼 |
| EKS | 클러스터 요금이 따로 붙고 서버 한 대 앱에 과함 |
| Lightsail | 가장 싸지만 CloudFront, S3, SSM과 섞어 쓰기 불편 |
| Docker 이미지 + ECR | 서버가 ARM이라 이미지를 ARM으로 다시 빌드해야 함. jar는 아키텍처와 상관없어 jar만 배포 |

## 3. 비용 (서울 리전, 월)
| 항목 | 단가 | 월 |
|---|---|---|
| EC2 t4g.small (2GB) | $0.0208/시간 | $15.18 |
| EBS gp3 20GB | $0.0912/GB-월 | $1.82 |
| 공인 IPv4 1개 | $0.005/시간 | $3.65 |
| CloudFront | 매달 1TB, 요청 1천만 건 무료 | $0 |
| S3 (프론트, 백업, jar) | 수백 MB | 약 $0.1 |
| Route 53 호스팅 영역 | $0.50 | $0.50 |
| SSM Parameter Store 기본 | 무료 | $0 |
| CloudWatch (기본 지표, 사용자 지표 10개, 경보 10개, 로그 5GB 무료 한도 안) | | $0 |
| **합계** | | **약 $21** |

- 따로: 도메인 연 약 $13~15, Anthropic API(피드백 1회 약 $0.0005, Haiku 5.5).
- 메모리가 빠듯하면 t4g.medium(4GB, 월 $30.37, 합계 약 $37)으로 올린다.
- 가격은 제3자 집계(aws-pricing.com)와 AWS 페이지 기준(2026-10-25). 띄우기 전에 AWS 요금 계산기로 다시 확인한다.
- 비용을 더 줄일 때: 반응을 본 뒤 1년 Savings Plan(서버비 약 30~40% 절감). 운영 시간 줄이기는 하지 않는다.

## 4. 인증과 보안
- **세션 인증**(토큰 인증 아님). 구글 OAuth 토큰은 서버(Spring Security)만 갖고, 브라우저에는 HttpOnly 세션 쿠키만 준다. 브라우저 앱에서 토큰을 자바스크립트가 만지지 않게 하는 BFF 방식과 같다. JWT는 XSS, 강제 로그아웃, 토큰 갱신 문제로 쓰지 않는다. 모바일 앱이 생기면 그 앱용 토큰을 따로 더한다.
- **세션 저장소: Spring Session JDBC**(PostgreSQL 테이블). 재시작과 배포에도 로그인 유지, 서버를 늘려도 공유. 탈퇴하면 그 사람의 모든 세션을 지운다. 대가: 요청마다 세션 읽기와 마지막 접속 시각 쓰기. 비교한 안: 메모리(재시작 시 유실), 톰캣 파일(컨테이너 교체 시 유실), Redis(컨테이너와 메모리 추가), 서명 쿠키와 JWT(강제 로그아웃 어려움), ElastiCache와 DynamoDB(비용).
- 로그인 유지 기간: 14일(쓸 때마다 연장), 만료 세션은 30분마다 정리.
- 세션 저장소는 JPA가 아닌 순수 JDBC 트랜잭션을 쓴다(`SessionConfig.kt`). JPA를 쓰면 멀티테넌시가 로그인 사용자를 물으며 세션을 다시 읽어 무한 반복된다. 분석: `docs/troubleshooting/2026-10-25-spring-session-login.md`
- **CSRF: 쿠키 방식**(`XSRF-TOKEN` 쿠키, 프론트가 `X-XSRF-TOKEN` 헤더로 보냄). 서버에 저장하지 않는다. SameSite=Lax로 막지 못하는 같은 사이트 서브도메인, 본문 없는 요청(탈퇴, 동의)을 한 겹 더 막는다.
- 쿠키: Secure, HttpOnly(세션), SameSite=Lax.
- 비밀값: SSM Parameter Store(SecureString). 구글 클라이언트 ID와 시크릿, `ANTHROPIC_API_KEY`(운영용 키 따로), DB 비밀번호(로컬 기본값 `jobscheduler`는 운영에서 쓰지 않음).
- GitHub에서 AWS로는 OIDC 역할(오래 가는 키 없음). 권한은 S3 업로드, CloudFront 무효화, SSM 명령 보내기만.
- 공개 저장소: Secret Scanning과 Push Protection을 켠다. 2026-10-25 기준 커밋 기록에 키 없음(확인함).

## 5. CI/CD (GitHub Actions)
| 언제 | 워크플로 | 하는 일 |
|---|---|---|
| `main` push, PR | `ci.yml` | 백엔드 `./gradlew test`, 프론트 `npm run build`와 `npm run lint` |
| 태그 `v*` push | `release.yml` | 검사 → jar와 프론트 빌드 → GitHub Release 생성(노트, jar와 프론트 빌드 첨부) → 배포 |

배포 단계(`release.yml`)
1. 프론트: `dist`를 S3에 올리고 CloudFront `/index.html` 등 무효화
2. 백엔드: jar를 S3(`releases/v0.x.y/`)에 올리고 SSM Run Command로 EC2에 "jar 받기, 컨테이너 다시 켜기"
3. Flyway 마이그레이션은 서버가 켜질 때 자동
4. `/actuator/health`가 정상이 될 때까지 확인, 실패하면 워크플로 실패

- 배포 중 약 10초 끊길 수 있다(서버 한 대). 세션은 DB에 있어 로그아웃되지 않는다.
- 버전: 정식 출시 전 `v0.MINOR.PATCH`. 기능은 MINOR, 수정은 PATCH. 첫 배포 `v0.1.0`.
- 릴리즈 노트 형식(이전 태그 이후 커밋과 변경 파일로 작성)
  - **핵심 변경**: 사용자 입장에서 바뀐 것
  - **DB 마이그레이션**: 이번에 추가된 Flyway 파일과 위험도(새 테이블, 인덱스만이면 무중단 안전 / 기존 열 변경이면 주의)
  - **배포 후 확인**: 체크박스(마이그레이션 적용 로그, 로그인 유지, 주요 화면, 주간 피드백)

## 6. 모니터링과 경보 (CloudWatch)
| 경보 | 조건(예시) |
|---|---|
| 서버 상태 | `StatusCheckFailed` ≥ 1, 자동 복구 |
| 서비스 접속 | 헬스 체크(`/actuator/health`) 2회 연속 실패 |
| API 오류 | CloudFront `5xxErrorRate` > 5% (5분) |
| 메모리 | `mem_used_percent` > 90% (10분, 에이전트) |
| 디스크 | `disk_used_percent` > 80% (에이전트) |
| CPU 크레딧 | `CPUCreditBalance` 바닥 근처(t4g는 버스트형) |

- 알림: SNS 이메일. 앱 로그는 CloudWatch Logs(INFO 이상, 보관 2주), ERROR 개수 지표 필터.
- Prometheus와 Grafana는 같은 서버에 띄우지 않는다(메모리, 서버가 죽으면 같이 죽음). 앱 내부 지표가 필요해지면 Grafana Cloud 무료부터.

## 7. 백업과 복구
- 매일 새벽 `pg_dump` → S3, 7일 보관(S3 수명 주기 규칙). 약관의 "백업 최대 7일"과 맞춤.
- 복구: S3에서 덤프 받기 → 컨테이너 멈춤 → `psql`로 복원 → 켜기. 처음 배포 뒤 한 번 연습해서 이 절차를 확인한다.
- EBS 스냅샷은 선택(주 1회).

## 8. 롤백
- S3 `releases/`에 최근 jar 5개를 남긴다. SSM 명령으로 이전 jar를 지정해 다시 켠다.
- 프론트는 이전 Release의 빌드를 S3에 다시 올리고 무효화.
- DB 마이그레이션은 되돌리지 않는다. 그래서 마이그레이션은 이전 버전 코드와도 같이 돌 수 있게(열 추가 먼저, 지우기는 다음 릴리즈) 쓴다.

## 9. 작업 순서
| 순서 | 작업 | AWS 필요 | 상태 |
|---|---|---|---|
| 0 | 사용자별 날짜 묶음 인덱스 | 아니요 | 완료 2026-10-25 |
| 1 | Spring Session JDBC, CSRF 쿠키 방식 | 아니요 | 완료 2026-10-25 |
| 2 | GitHub 공개 저장소, Secret Scanning과 Push Protection | 아니요 | |
| 3 | CI 워크플로(`ci.yml`) | 아니요 | 완료 2026-10-25 |
| 4 | 릴리즈 워크플로(`release.yml`), 배포 단계는 꺼 둔 채 Release 생성까지 | 아니요 | |
| 5 | 운영 설정(`application-prod.yml`, Secure 쿠키, 로그), Docker Compose 운영 파일 | 아니요 | |
| 6 | 도메인, AWS 인프라(EC2, S3, CloudFront, ACM, SSM, OIDC 역할, CloudWatch) | 예 | |
| 7 | 구글 OAuth 운영 도메인 추가와 프로덕션 게시, 운영용 Anthropic 키 | 예 | |
| 8 | 배포 단계 켜고 첫 배포 `v0.1.0`, 백업 복구 연습 | 예 | |

직접 해 주셔야 할 것: GitHub 저장소 만들기, 도메인 구입, AWS 계정과 결제, 구글 OAuth 콘솔 설정.

## 10. 늘릴 때의 기준
| 신호 | 할 일 |
|---|---|
| 메모리 90% 넘는 때가 잦음 | t4g.medium으로 올리기 |
| 랭킹, 캐시, 서버 여러 대가 필요 | Redis 추가, 세션도 Redis로(설정만 바꿈) |
| 대시보드 리포트가 1초 넘음 | 쿼리, 인덱스 먼저 보고, 그다음 캐시 |
| DB 관리 부담, 가용성 요구 | RDS로 옮기기 |
| 배포 중 끊김이 문제 | 서버 두 대 + ALB(무중단 배포) |
| 앱 내부 지표 필요 | Grafana Cloud 무료 |
| 연속 공부일 계산이 느려짐 | 조회 범위를 365일에서 줄이기 |
