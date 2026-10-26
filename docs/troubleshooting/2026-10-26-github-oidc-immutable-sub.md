# Problem analysis result: 첫 배포에서 GitHub OIDC 역할을 받지 못함

- 날짜: 2026-10-26
- 영역: 배포(GitHub Actions OIDC, AWS IAM, CloudFormation)
- 관련 커밋: release.yml 배포 단계 추가, `deploy/infra.yml` 신뢰 정책과 AMI 고정

## 1. 증상
- `v0.1.0` 태그의 Release 워크플로에서 검사, 결과물, GitHub Release는 성공하고 `운영 배포`만 실패했다.
- `aws-actions/configure-aws-credentials`가 12번 다시 시도한 뒤 `Not authorized to perform sts:AssumeRoleWithWebIdentity`로 끝났다.

## 2. 원인
- 배포 역할의 신뢰 정책은 토큰의 `sub`가 `repo:SANGWOO-JOO/next-step:ref:refs/tags/v*`일 때만 허용했다.
- 이 저장소는 GitHub의 **변하지 않는 subject** 설정을 쓰고 있었다. `gh api repos/SANGWOO-JOO/next-step/actions/oidc/customization/sub` 결과가 `use_immutable_subject: true`, 접두사 `repo:SANGWOO-JOO@97161681/next-step@1432408788`였다.
- 그래서 실제 `sub`는 `repo:SANGWOO-JOO@97161681/next-step@1432408788:ref:refs/tags/v0.1.0`이었고 조건과 맞지 않았다. 이름 뒤에 숫자 ID가 붙어 저장소 이름이 바뀌거나 같은 이름으로 새 저장소를 만들어도 권한이 넘어가지 않게 하는 형식이다.

## 3. 해결
- 신뢰 정책 `sub` 조건에 두 형식을 모두 넣었다(예전 형식, 변하지 않는 형식).
- 템플릿(`deploy/infra.yml`)에 `GitHubImmutableRepository` 파라미터와 조건을 더했다.
- **스택 갱신 대신 IAM에서 신뢰 정책만 직접 고쳤다.** 변경 세트를 만들어 보니 `AppInstance`가 "교체 가능(Conditional)"으로 나왔기 때문이다.
  - 원인: 템플릿이 AMI를 `{{resolve:ssm:...latest...}}`로 읽는다. CloudFormation은 이 값을 미리 비교할 수 없어 서버 교체 가능성을 표시한다. AMI를 고정해도 "속성 글자가 바뀐 것"이라 다시 Conditional이었다.
  - 서버가 교체되면 EC2 안 PostgreSQL 데이터가 사라지므로, 실제 AMI가 같아도 위험을 감수하지 않았다.
- 템플릿은 지금 서버 AMI로 고정했다(`AppImageId`). 스택에는 아직 반영하지 않아 잠시 드리프트가 있다.
- 실패한 배포 작업만 다시 돌려(`gh run rerun --failed`) 성공했다.

## 4. 검증
| 확인 | 결과 |
|---|---|
| 배포 작업 다시 실행 | OIDC, S3 업로드, SSM 재시작, 프론트 업로드, 공개 주소 확인 모두 성공 |
| `https://nextstep-plan.work/api/health` | `UP`, DB `UP` |
| 서버 로그 | prod 프로필, 마이그레이션 31개 적용 |

## 5. 배운 점
- GitHub OIDC 신뢰 정책을 만들기 전에 `actions/oidc/customization/sub`로 실제 `sub` 형식을 먼저 본다.
- EC2 안에 DB를 두는 구조에서는 **AMI를 처음부터 고정**한다. "최신 AMI"를 읽으면 나중 스택 갱신이 서버 교체로 번질 수 있다.
- 스택 갱신은 항상 변경 세트로 먼저 보고, 서버(`AppInstance`)가 교체 대상이면 백업 후 진행한다.
