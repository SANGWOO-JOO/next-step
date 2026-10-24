package com.jobscheduler.config

import com.jobscheduler.TestUser
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.DefaultMockMvcBuilder
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.context.WebApplicationContext

/**
 * CSRF 쿠키 방식(docs/deploy.md 4장): 토큰 없는 변경 요청은 막는다.
 * XSRF-TOKEN 쿠키가 내려가는지는 MockMvc에서 보이지 않아 실제 서버(curl)로 확인했다
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class CsrfTest(@Autowired private val context: WebApplicationContext) {
    // 기본 CSRF 토큰을 붙이지 않은 MockMvc
    private val mvc = MockMvcBuilders.webAppContextSetup(context).apply<DefaultMockMvcBuilder>(springSecurity()).build()
    private val me = authentication(UsernamePasswordAuthenticationToken(TestUser(1L), null, emptyList()))

    @Test
    fun `토큰 없는 변경 요청은 403이다`() {
        mvc.perform(post("/api/me/ai-consent").with(me)).andExpect(status().isForbidden)
    }

    @Test
    fun `토큰이 있으면 통과한다`() {
        mvc.perform(post("/api/me/ai-consent").with(me).with(csrf())).andExpect(status().isOk)
    }
}
