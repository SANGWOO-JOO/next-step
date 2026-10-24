# Problem analysis result: 다른 Gradle 데몬이 캐시를 잡아 테스트가 돌지 않음

- 날짜: 2026-10-25(2-8 대시보드 개편 중)
- 영역: 로컬 개발 환경(Gradle)

## 1. 증상
- `./gradlew test`가 2분쯤 기다리다 실패. 세 번 연속 같은 결과
- 에러: `Timeout waiting to lock artifact cache (~/.gradle/caches/modules-2). It is currently in use by another Gradle instance. Owner PID: 25740`
- 같은 이유로 `bootRun`도 다시 켤 수 없었다.

## 2. 원인 분석
- `ps`로 PID를 보니 **Gradle 9.8.2 데몬**(`GradleDaemon`, 30분 넘게 실행 중)이었다.
- 이 프로젝트는 Gradle 8.14.3을 쓴다(`./gradlew --status`). 즉 **다른 프로젝트나 IDE가 띄운 데몬**이 사용자 공용 캐시(`~/.gradle/caches/modules-2`)의 잠금을 놓지 않고 있었다.
- 마침 이번 작업에서 새 의존성(`anthropic-java`)을 받아야 해서, 캐시 잠금이 필요한 순간에 막혔다.

## 3. 해결
1. 잠금을 잡은 프로세스 확인: `ps -p <PID> -o command=`
2. 이 프로젝트 것이 아님을 확인하고, 사용자에게 멈춰도 되는지 물은 뒤 종료: `kill <PID>`
3. 테스트 다시 실행 → 112개 통과

## 4. 배운 점
- `Timeout waiting to lock … Owner PID`가 보이면 먼저 그 PID가 무엇인지 본다. 다른 Gradle 버전의 데몬이면 다른 프로젝트나 IDE 것이다.
- 남의 프로세스는 바로 죽이지 않고 확인한 뒤 끈다. 멈춘 데몬은 그 프로젝트가 다음에 Gradle을 쓸 때 다시 뜬다.
- 같은 캐시를 여러 Gradle 버전이 함께 쓰므로, IDE의 Gradle 동기화가 오래 걸릴 때 겹치기 쉽다.
