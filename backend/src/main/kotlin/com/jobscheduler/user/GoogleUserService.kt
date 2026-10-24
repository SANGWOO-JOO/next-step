package com.jobscheduler.user

import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser
import org.springframework.security.oauth2.core.oidc.user.OidcUser
import org.springframework.stereotype.Component

/** 구글 로그인 주체 + 우리 사용자 id */
class AppOidcUser(override val userId: Long, user: OidcUser) :
    DefaultOidcUser(user.authorities, user.idToken, user.userInfo, "sub"), UserPrincipal

/** 구글이 돌려준 프로필로 우리 사용자를 찾거나 만든다(docs/design.md 11-2) */
@Component
class GoogleUserService(private val userService: UserService) : OidcUserService() {
    override fun loadUser(userRequest: OidcUserRequest): OidcUser {
        val google = super.loadUser(userRequest)
        val user = userService.signIn(
            sub = google.subject,
            email = google.email,
            name = google.fullName,
            pictureUrl = google.picture,
        )
        return AppOidcUser(user.id!!, google)
    }
}
