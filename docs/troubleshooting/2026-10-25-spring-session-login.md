# Problem analysis result: 세션 저장소 변경 후 구글 로그인 500

- 날짜: 2026-10-25
- 영역: 백엔드 인증(Spring Security, Spring Session JDBC, Hibernate 멀티테넌시)
- 관련 커밋: `9bae360`(Spring Session JDBC, CSRF 도입), `e4ca39b`(수정)
- 관련 설계: `docs/deploy.md` 4장 인증과 보안

## 1. 배경
- 세션이 서버 메모리(톰캣 HttpSession)에 있어서 서버를 다시 켤 때마다 모든 사용자가 로그아웃됐다. 배포할 때마다 같은 일이 생길 문제였다.
- 해결하려고 세션 저장소를 PostgreSQL로 바꿨다(Spring Session JDBC). 같은 작업에서 CSRF를 쿠키 방식으로 켰다.

## 2. 증상
- 서버를 다시 켠 뒤 구글 로그인을 하면 콜백 주소(`/login/oauth2/code/google?state=…`)에서 **HTTP 500 Internal Server Error**.
- 로그인이 전혀 되지 않음. 이미 로그인한 사용자도 세션을 읽는 순간 같은 에러가 날 수 있는 상태.
- 백엔드 테스트 116개는 모두 통과한 상태였다.

## 3. 로그
```
CannotCreateTransactionException: Could not open JPA EntityManager for transaction
Caused by: java.lang.StackOverflowError
  at AbstractPlatformTransactionManager.startTransaction
  at TransactionTemplate.execute
  at JdbcIndexedSessionRepository.findById
  at SessionRepositoryFilter$SessionRepositoryRequestWrapper.getSession
  at HttpSessionSecurityContextRepository.loadDeferredContext
  at SecurityContextHolder.getContext
  at CurrentUser.idOrNull
  at CurrentUserTenantResolver.resolveCurrentTenantIdentifier
  at SessionFactoryImpl.buildEntityManager
  ... (반복)
```

## 4. 원인 분석
호출이 원을 그리며 끝없이 반복됐다(StackOverflowError).

1. 요청이 들어오면 Spring Session(`JdbcIndexedSessionRepository.findById`)이 DB에서 세션을 읽으려고 **트랜잭션을 연다.**
2. 따로 지정하지 않아서 앱의 기본 트랜잭션 매니저, 즉 **JPA 트랜잭션 매니저**를 썼다.
3. JPA 트랜잭션은 EntityManager를 연다. 이때 Hibernate 멀티테넌시(`@TenantId`, 2-1에서 도입)가 **현재 테넌트(로그인 사용자 id)**를 `CurrentUserTenantResolver`에게 묻는다.
4. `CurrentUser.idOrNull()`은 `SecurityContextHolder.getContext()`를 부른다. Spring Security 6의 보안 컨텍스트는 지연 로딩이라, 이 순간 **세션을 읽어** 로그인 정보를 꺼내려 한다.
5. 세션 읽기는 1번으로 돌아간다.

메모리 세션일 때는 세션을 읽는 데 DB와 트랜잭션이 필요 없어서 이 고리가 생기지 않았다. 세션 저장소를 DB로 옮기면서 "세션 읽기 → JPA → 테넌트 → 세션 읽기" 고리가 처음 생겼다.

## 5. 왜 테스트에서 못 잡았나
- 테스트는 가짜 로그인 사용자를 `TestSecurityContextHolder`에 직접 넣는다(`TestUsers.loginAs`). 보안 컨텍스트를 세션에서 읽는 경로(`HttpSessionSecurityContextRepository`)를 타지 않는다.
- 그래서 "세션에서 로그인 정보를 지연 로딩하면서 JPA가 테넌트를 묻는" 순간이 테스트에 없었다. 실제 구글 로그인에서만 드러났다.

## 6. 해결
Spring Session에 **JPA를 거치지 않는 순수 JDBC 트랜잭션 매니저**를 따로 준다. 세션을 읽을 때 EntityManager를 열지 않으니 테넌트를 묻지 않고, 고리가 끊긴다.

`backend/src/main/kotlin/com/jobscheduler/config/SessionConfig.kt`
```kotlin
@Bean
@Primary
fun transactionManager(entityManagerFactory: EntityManagerFactory): PlatformTransactionManager =
    JpaTransactionManager(entityManagerFactory)

@Bean
@SpringSessionTransactionManager
fun springSessionTransactionManager(dataSource: DataSource): PlatformTransactionManager =
    DataSourceTransactionManager(dataSource)
```

- 처음에는 세션 전용 매니저만 추가했더니, 스프링 부트가 "트랜잭션 매니저가 이미 있다"고 보고 기본 JPA 매니저를 만들지 않았다. 그래서 테스트 다수가 `No bean named 'transactionManager'`로 실패했다.
- 앱 기본 JPA 매니저를 `@Primary`로 직접 다시 둬서 해결했다.
- 시도했다가 버린 것: `@SpringSessionTransactionOperations`(이 버전의 Spring Session JDBC 3.5.2에는 없음, 실제 있는 것은 `@SpringSessionTransactionManager`).

## 7. 검증
| 확인 | 결과 |
|---|---|
| 백엔드 테스트 | 116개 통과 |
| 로그인 직후 `/api/me` | 200, DB `spring_session`에 세션 저장 |
| 서버를 끄고 다시 켬 | |
| 재시작 뒤 `/api/me` | 200(이름 "_ Joo"), 다시 로그인하지 않음 |
| 재시작 뒤 CSRF 토큰을 붙인 변경 요청(알림 설정 저장, 같은 값) | 200, 설정은 바뀌지 않음 |
| 같은 요청을 토큰 없이 | 403 |

## 8. 배운 점과 재발 방지
- **세션 저장소를 바꾸면 "세션을 읽는 코드"와 "세션을 읽게 만드는 코드"가 서로 부르는지 본다.** 멀티테넌시처럼 모든 DB 접근 전에 로그인 사용자를 묻는 장치가 있으면, 세션 저장소는 그 장치를 거치지 않는 경로(순수 JDBC)를 써야 한다.
- **가짜 로그인 테스트만으로는 인증 저장 경로를 검증하지 못한다.** 인증, 세션, CSRF를 바꾸면 테스트와 별개로 실제 로그인 → 서버 재시작 → 유지 확인을 체크리스트에 넣는다(`docs/deploy.md` 5장 배포 후 확인).
- 나중에 세션을 Redis로 옮겨도 같은 원리다. 세션 저장소가 JPA 트랜잭션을 타지 않으면 문제없다.
