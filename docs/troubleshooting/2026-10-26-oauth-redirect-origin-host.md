# Problem analysis result: 운영에서 구글 계정을 고르면 화면이 넘어가지 않음

- 날짜: 2026-10-26
- 영역: 배포(CloudFront, Tomcat 리다이렉트, 구글 로그인)
- 관련 버전: `v0.1.0`에서 발생, `v0.1.1`에서 수정

## 1. 증상
- https://nextstep-plan.work 에서 구글 로그인을 누르고 계정을 고르면, 구글 화면에서 로딩만 계속되고 서비스로 돌아오지 않았다.
- 서버 로그에는 오류가 없었다.

## 2. 원인
- 콜백 주소를 직접 호출해 보니 서버가 `Location: https://origin.nextstep-plan.work/login?error`로 보냈다.
- CloudFront는 EC2로 요청을 보낼 때 `Host`를 오리진 이름(`origin.nextstep-plan.work`)으로 바꾼다. 앱의 리다이렉트는 `/`, `/login?error` 같은 상대 주소인데, Tomcat이 이것을 받은 `Host`로 절대 주소를 만들었다.
- 그래서 로그인 성공 뒤 브라우저가 `https://origin.nextstep-plan.work/`로 갔다. 그 주소는 HTTPS를 받지 않아(보안 그룹도 CloudFront만 허용) 연결이 멈췄다.
- 로컬은 Vite 프록시가 `Host`를 그대로 두어 드러나지 않았다. 5단계 로컬 운영 확인에서는 구글 로그인 시작 주소만 봤고, 콜백 뒤 리다이렉트는 HTTPS가 없어 확인하지 못했다.

## 3. 해결
`application-prod.yml`
```yaml
server:
  tomcat:
    use-relative-redirects: true
```
- Tomcat이 리다이렉트를 상대 주소 그대로 보내고, 브라우저가 지금 주소(`nextstep-plan.work`) 기준으로 이동한다.
- 고르지 않은 방법: CloudFront가 사용자 `Host`를 그대로 넘기게 하기. 인프라 스택을 갱신해야 해서(서버 교체 위험, `docs/deploy.md` 스택 갱신 주의) 앱 설정으로 해결했다.

## 4. 검증
| 확인 | 수정 전 | 수정 후 |
|---|---|---|
| `/login/oauth2/code/google?code=test&state=test`의 `Location` | `https://origin.nextstep-plan.work/login?error` | `/login?error` |

## 5. 배운 점
- 프록시 뒤 앱은 리다이렉트 주소를 꼭 확인한다. `Location` 헤더 하나로 바로 드러난다.
- CloudFront의 오리진 이름이 앱에 보이는 곳(리다이렉트, 절대 링크 생성)이 없는지 본다.
