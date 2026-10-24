package com.jobscheduler.user

import org.junit.jupiter.api.Test
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken
import org.springframework.security.oauth2.core.oidc.OidcIdToken
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.ObjectInputStream
import java.io.ObjectOutputStream
import java.time.Instant
import kotlin.test.assertEquals

/** 세션을 DB에 저장하려면 로그인 정보가 직렬화돼야 한다(Spring Session JDBC, docs/deploy.md 4장) */
class SessionSerializationTest {
    @Test
    fun `구글 로그인 주체는 직렬화하고 되살려도 사용자 id가 같다`() {
        val idToken = OidcIdToken("token", Instant.now(), Instant.now().plusSeconds(60), mapOf("sub" to "google-1"))
        val principal = AppOidcUser(7L, DefaultOidcUser(listOf(SimpleGrantedAuthority("OIDC_USER")), idToken, "sub"))
        val auth = OAuth2AuthenticationToken(principal, principal.authorities, "google")

        val bytes = ByteArrayOutputStream().also { ObjectOutputStream(it).use { o -> o.writeObject(auth) } }.toByteArray()
        val restored = ObjectInputStream(ByteArrayInputStream(bytes)).use { it.readObject() } as OAuth2AuthenticationToken

        assertEquals(7L, (restored.principal as UserPrincipal).userId)
        assertEquals("google-1", restored.name)
    }
}
