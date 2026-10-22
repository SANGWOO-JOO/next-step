package com.jobscheduler.category

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class CategoryControllerTest(@Autowired private val mockMvc: MockMvc) {

    @Test
    fun `분류 목록을 조회한다`() {
        mockMvc.get("/api/categories").andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(6) }
            jsonPath("$[0].name") { value("이력서 작성") }
        }
    }

    @Test
    fun `분류를 추가하면 201을 반환한다`() {
        mockMvc.post("/api/categories") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"name":"네트워킹","color":"#0ea5e9","targetRatio":10}"""
        }.andExpect {
            status { isCreated() }
            jsonPath("$.name") { value("네트워킹") }
            jsonPath("$.active") { value(true) }
        }
    }

    @Test
    fun `색상 형식이 틀리면 검증 오류를 반환한다`() {
        mockMvc.post("/api/categories") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"name":"네트워킹","color":"blue"}"""
        }.andExpect {
            status { isBadRequest() }
            jsonPath("$.code") { value("VALIDATION_FAILED") }
            jsonPath("$.fieldErrors[0].field") { value("color") }
        }
    }
}
