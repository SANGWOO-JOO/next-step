# Problem analysis result: CI(UTC)에서만 테스트 3개 실패

- 날짜: 2026-10-25
- 영역: CI, 백엔드 테스트 환경(시간대)
- 관련 커밋: `f41147a`(CI 추가), `c943a9b`(수정)
- 관련 설계: `docs/deploy.md` 5장 CI/CD

## 1. 배경
- GitHub Actions에 `ci.yml`을 처음 올렸다. 백엔드는 `./gradlew test`, 프론트는 린트와 빌드를 돌린다.
- 로컬(macOS, 시간대 Asia/Seoul)에서는 테스트 116개가 모두 통과하던 상태였다.

## 2. 증상
- CI 첫 실행에서 프론트 작업은 성공, 백엔드 작업만 실패했다.
- `116 tests completed, 3 failed`

| 테스트 | 실패 위치 |
|---|---|
| `OnboardingServiceTest` 목적과 첫 목표를 저장하고 칠한 칸을 날짜마다 할 일 하나와 블록으로 만든다 | 70행, 날짜별 할 일 목록 비교(`AssertionFailedError`) |
| `OnboardingServiceTest` 주말에 시작해도 이번 주 남은 날만 칠한다 | 104행(`AssertionFailedError`) |
| `UserIsolationTest` 다른 사용자의 데이터는 … 지울 수 없다 | 64행, 실제 기록 저장에서 `BusinessRuleException` |

세 테스트 모두 `+09:00` 시각을 날짜로 바꾸거나, 30분 칸에 맞는지 검사하는 곳이다.

## 3. 원인 분석
1. GitHub 러너(ubuntu-latest)의 기본 시간대는 **UTC**다. 로컬은 Asia/Seoul이라 차이가 드러나지 않았다.
2. 운영에서는 `main()`이 스프링을 켜기 전에 `TimeZone.setDefault(Asia/Seoul)`을 부른다. 그래서 DB 드라이버, Hibernate, Flyway가 모두 처음부터 서울 시간으로 시작한다.
3. 테스트(`@SpringBootTest`)는 **`main()`을 거치지 않는다.** 시간대는 `JobSchedulerApplication`의 `@PostConstruct`에서야 바뀐다.
4. 그 사이에 데이터소스와 H2, Hibernate가 먼저 만들어지면서 UTC를 기준으로 잡는다. 이후 `+09:00` 시각을 저장하고 읽을 때 기준이 어긋나, 날짜가 하루 밀리거나 "30분 칸에 맞지 않음" 규칙에 걸렸다.

재현: 로컬에서 `TZ=UTC ./gradlew test --rerun-tasks`로 같은 3개가 그대로 실패했다. 시간대 하나만 바꿔 재현됐으니 원인은 시간대가 맞다.
(정확히 어느 구성 요소가 시간대를 먼저 잡아 두는지까지는 추적하지 않았다. H2가 JVM 시간대를 처음 쓸 때 저장해 두는 동작이 가장 유력하다.)

## 4. 해결
테스트 JVM을 처음부터 Asia/Seoul로 띄운다. 운영의 `main()`과 같은 조건이 된다.

`backend/build.gradle.kts`
```kotlin
tasks.withType<Test> {
    useJUnitPlatform()
    // 운영은 main()에서 시간대를 정하지만 테스트는 main()을 거치지 않는다. CI 러너(UTC)에서도 같게 맞춘다
    systemProperty("user.timezone", "Asia/Seoul")
}
```

- 운영 코드는 바꾸지 않았다. 운영 서버(EC2, UTC)도 `main()`에서 시간대를 정하므로 영향이 없다.
- 고르지 않은 방법: 워크플로에 `TZ: Asia/Seoul` 환경 변수 넣기. CI에서만 고쳐지고, 다른 개발자 PC나 컨테이너에서는 다시 생길 수 있다.

## 5. 검증
| 확인 | 결과 |
|---|---|
| 로컬 `TZ=UTC ./gradlew test --rerun-tasks` (수정 전) | 3개 실패 |
| 같은 명령 (수정 후) | 116개 통과 |
| GitHub Actions 다시 실행 | 백엔드, 프론트 모두 성공 |

## 6. 배운 점과 재발 방지
- **"내 PC에서는 된다"의 흔한 원인은 시간대, 로케일, 파일 경로 대소문자다.** CI 러너는 UTC, 영어 로케일, 대소문자를 구분하는 파일 시스템이다.
- **`main()`에서만 하는 초기화는 테스트에 없다.** 시간대처럼 전역 설정은 JVM 옵션(`user.timezone`)이나 빌드 설정에도 같이 둔다.
- 시간대가 의심되면 `TZ=UTC`로 로컬에서 먼저 재현해 본다. CI 로그를 기다리는 것보다 빠르다.
- 운영 Docker 이미지에도 `-Duser.timezone=Asia/Seoul`을 넣을지 5단계(운영 설정)에서 정한다. `main()`이 있어 꼭 필요하지는 않지만, 같은 문제를 원천적으로 막는다.
