package com.jobscheduler.config

import com.jobscheduler.user.GoogleUserService
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpStatus
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.HttpStatusEntryPoint
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter
import org.springframework.security.web.csrf.CookieCsrfTokenRepository
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler
import org.springframework.security.web.util.matcher.AntPathRequestMatcher

/**
 * 구글 로그인 + 서버 세션(docs/design.md 11-6 2-1).
 * 로그인 안 한 /api 요청은 401. 세션은 Spring Session JDBC로 PostgreSQL에, CSRF는 쿠키 방식.
 */
@Configuration
class SecurityConfig(private val googleUserService: GoogleUserService) {
    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
        http
            // CSRF는 쿠키 방식(docs/deploy.md 4장): XSRF-TOKEN 쿠키를 프론트가 X-XSRF-TOKEN 헤더로 보낸다. 서버에 저장하지 않는다
            .csrf {
                it.csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                it.csrfTokenRequestHandler(SpaCsrfTokenRequestHandler())
            }
            .addFilterAfter(CsrfCookieFilter(), BasicAuthenticationFilter::class.java)
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
