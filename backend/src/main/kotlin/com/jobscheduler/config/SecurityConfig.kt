package com.jobscheduler.config

import com.jobscheduler.user.GoogleUserService
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpStatus
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.HttpStatusEntryPoint
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler
import org.springframework.security.web.util.matcher.AntPathRequestMatcher

/**
 * 구글 로그인 + 서버 세션(docs/design.md 11-6 2-1).
 * 로그인 안 한 /api 요청은 401. CSRF 토큰은 배포(2-4) 때 넣고, 지금은 세션 쿠키 SameSite=Lax로 막는다.
 */
@Configuration
class SecurityConfig(private val googleUserService: GoogleUserService) {
    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
        http
            .csrf { it.disable() }
            .cors { }
            .authorizeHttpRequests {
                it.requestMatchers("/api/health", "/actuator/health").permitAll()
                    .requestMatchers("/api/**").authenticated()
                    .anyRequest().permitAll()
            }
            .exceptionHandling {
                it.defaultAuthenticationEntryPointFor(
                    HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED),
                    AntPathRequestMatcher("/api/**"),
                )
            }
            .oauth2Login {
                it.userInfoEndpoint { endpoint -> endpoint.oidcUserService(googleUserService) }
                it.defaultSuccessUrl("/", true)
            }
            .logout {
                it.logoutUrl("/logout")
                it.logoutSuccessHandler(HttpStatusReturningLogoutSuccessHandler(HttpStatus.NO_CONTENT))
            }
        return http.build()
    }
}
