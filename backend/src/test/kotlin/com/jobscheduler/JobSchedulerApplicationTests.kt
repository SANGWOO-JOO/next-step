package com.jobscheduler

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class JobSchedulerApplicationTests(@Autowired private val mockMvc: MockMvc) {

    @Test
    fun `헬스 체크는 서버와 DB 상태를 반환한다`() {
        mockMvc.get("/api/health").andExpect {
            status { isOk() }
            jsonPath("$.status") { value("UP") }
            jsonPath("$.database") { value("UP") }
            jsonPath("$.zone") { value("Asia/Seoul") }
        }
    }

    @Test
    fun `없는 경로는 공통 에러 형식으로 404를 반환한다`() {
        mockMvc.get("/api/not-exists").andExpect {
            status { isNotFound() }
            jsonPath("$.code") { value("NOT_FOUND") }
        }
    }
}
