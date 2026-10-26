# CloudFormation에서 CloudFront 배포가 실패함

## 증상
- 첫 스택 생성 시 CloudFormation이 `CAPABILITY_NAMED_IAM`을 요구했다. 이 단계에서는 리소스를 만들기 전에 빈 스택이 롤백됐다.
- 권한 플래그를 추가해 다시 실행하자 `The specified cache policy does not exist` 오류로 CloudFront 배포가 실패했다.

## 원인
- 템플릿이 이름이 지정된 IAM 역할과 OIDC 공급자를 만들지만 `CAPABILITY_NAMED_IAM`을 전달하지 않았다.
- `CachingDisabled` 관리형 정책 ID가 AWS 계정의 CloudFront 관리형 정책 ID와 달랐다. CloudFormation 정적 문법 검증은 해당 ID가 실제로 존재하는지 확인하지 않는다.

## 해결
- 스택 생성에 `--capabilities CAPABILITY_NAMED_IAM`을 추가했다.
- AWS CLI `cloudfront list-cache-policies --type managed`로 정책 ID를 조회해 `deploy/infra.yml`의 모든 API 동작에 올바른 `CachingDisabled` ID를 설정했다.
- 실패한 스택의 롤백 완료와 리소스 정리를 확인한 뒤 수정한 템플릿으로 다시 배포했다.

## 검증
- `next-step-infra`와 `next-step-cloudfront-monitoring`이 `CREATE_COMPLETE`가 됐다.
- `https://nextstep-plan.work/`가 인증서 검증을 통과하고 HTTP 200을 반환했다.

## 배운 점
- CloudFront 관리형 정책 ID는 기억에 의존하지 말고 AWS 계정에서 직접 확인한다.
- IAM 역할을 만드는 CloudFormation 스택에는 필요한 IAM capability를 명시한다.
