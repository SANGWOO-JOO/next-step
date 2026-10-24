package com.jobscheduler

import com.jobscheduler.user.UserPrincipal
import org.junit.jupiter.api.extension.AfterEachCallback
import org.junit.jupiter.api.extension.BeforeEachCallback
import org.junit.jupiter.api.extension.ExtensionContext
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.test.context.TestSecurityContextHolder

/** 테스트용 로그인 사용자. 사용자 1·2는 테스트 전용 Flyway 데이터(db/testdata)에 있다 */
data class TestUser(override val userId: Long) : UserPrincipal

object TestUsers {
    const val ME = 1L
    const val OTHER = 2L

    fun loginAs(userId: Long) {
        TestSecurityContextHolder.setAuthentication(UsernamePasswordAuthenticationToken(TestUser(userId), null, emptyList()))
    }
}

/**
 * 모든 테스트를 사용자 1로 로그인한 상태에서 시작한다(junit-platform.properties의 자동 등록).
 * 스프링 테스트 트랜잭션보다 먼저 돌아야 Hibernate 세션이 사용자 1로 열린다.
 */
class TestUserExtension : BeforeEachCallback, AfterEachCallback {
    override fun beforeEach(context: ExtensionContext) = TestUsers.loginAs(TestUsers.ME)

    override fun afterEach(context: ExtensionContext) = TestSecurityContextHolder.clearContext()
}
