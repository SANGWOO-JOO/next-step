package com.jobscheduler.config

import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcBuilderCustomizer
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.setup.ConfigurableMockMvcBuilder

/** 컨트롤러 테스트의 모든 요청에 CSRF 토큰을 붙인다. CSRF 자체는 CsrfTest에서 따로 확인한다 */
@Configuration
class TestCsrfConfig {
    @Bean
    fun csrfByDefault() = MockMvcBuilderCustomizer { it.defaultRequest<ConfigurableMockMvcBuilder<*>>(get("/").with(csrf())) }
}
