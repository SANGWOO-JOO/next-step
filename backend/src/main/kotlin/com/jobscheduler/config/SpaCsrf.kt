package com.jobscheduler.config

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.web.csrf.CsrfToken
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler
import org.springframework.security.web.csrf.CsrfTokenRequestHandler
import org.springframework.security.web.csrf.XorCsrfTokenRequestAttributeHandler
import org.springframework.util.StringUtils
import org.springframework.web.filter.OncePerRequestFilter
import java.util.function.Supplier

/**
 * SPA용 CSRF(Spring Security 문서의 방식, docs/deploy.md 4장).
 * 헤더(X-XSRF-TOKEN)로 온 값은 쿠키 값 그대로 비교하고, 서버가 그리는 폼은 BREACH 보호(XOR)를 쓴다.
 */
class SpaCsrfTokenRequestHandler : CsrfTokenRequestHandler {
    private val plain = CsrfTokenRequestAttributeHandler()
    private val xor = XorCsrfTokenRequestAttributeHandler()

    override fun handle(request: HttpServletRequest, response: HttpServletResponse, csrfToken: Supplier<CsrfToken>) {
        xor.handle(request, response, csrfToken)
        // 지연된 토큰을 꺼내 XSRF-TOKEN 쿠키가 내려가게 한다
        csrfToken.get()
    }

    override fun resolveCsrfTokenValue(request: HttpServletRequest, csrfToken: CsrfToken): String? =
        if (StringUtils.hasText(request.getHeader(csrfToken.headerName))) plain.resolveCsrfTokenValue(request, csrfToken)
        else xor.resolveCsrfTokenValue(request, csrfToken)
}

/** 모든 요청에서 CSRF 토큰을 꺼내 XSRF-TOKEN 쿠키가 항상 내려가게 한다 */
class CsrfCookieFilter : OncePerRequestFilter() {
    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, filterChain: FilterChain) {
        (request.getAttribute(CsrfToken::class.java.name) as? CsrfToken)?.token
        filterChain.doFilter(request, response)
    }
}
