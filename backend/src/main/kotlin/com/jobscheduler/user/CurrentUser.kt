package com.jobscheduler.user

import org.hibernate.context.spi.CurrentTenantIdentifierResolver
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Component

/** 로그인한 사용자를 담은 인증 주체. 구글 로그인과 테스트의 가짜 사용자가 함께 쓴다 */
interface UserPrincipal {
    val userId: Long
}

/**
 * 지금 요청의 사용자(docs/design.md 11-6 2-1). 로그인 정보에서 읽고,
 * 로그인 처리 중처럼 아직 로그인 정보가 없을 때는 [runAs]로 잠깐 지정한다.
 */
object CurrentUser {
    /** 사용자가 없을 때의 테넌트. 이 값으로는 어떤 데이터도 보이지 않는다 */
    const val NOBODY = 0L

    private val override = ThreadLocal<Long?>()

    fun idOrNull(): Long? =
        override.get() ?: (SecurityContextHolder.getContext().authentication?.principal as? UserPrincipal)?.userId

    fun id(): Long = idOrNull() ?: throw IllegalStateException("로그인한 사용자가 없어요")

    fun <T> runAs(userId: Long, block: () -> T): T {
        val previous = override.get()
        override.set(userId)
        try {
            return block()
        } finally {
            override.set(previous)
        }
    }
}

/** Hibernate 세션을 열 때 테넌트(=사용자 id)를 정한다. @TenantId 열로 저장·조회가 그 사용자로 한정된다 */
@Component
class CurrentUserTenantResolver : CurrentTenantIdentifierResolver<Long>, HibernatePropertiesCustomizer {
    override fun resolveCurrentTenantIdentifier(): Long = CurrentUser.idOrNull() ?: CurrentUser.NOBODY

    override fun validateExistingCurrentSessions(): Boolean = false

    override fun customize(hibernateProperties: MutableMap<String, Any>) {
        hibernateProperties["hibernate.tenant_identifier_resolver"] = this
    }
}
