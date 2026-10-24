package com.jobscheduler.goal

import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.patch
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.put
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class GoalControllerTest(
    @Autowired private val mockMvc: MockMvc,
    @Autowired private val objectMapper: ObjectMapper,
) {
    private fun createGoal(body: String): Long {
        val json = mockMvc.post("/api/goals") {
            contentType = MediaType.APPLICATION_JSON
            content = body
        }.andExpect { status { isCreated() } }.andReturn().response.contentAsString
        return objectMapper.readTree(json)["id"].asLong()
    }

    @Test
    fun `목표를 만들고 주 목표 시간을 정하면 계획 화면에 나온다`() {
        val id = createGoal("""{"title":"이력서 완성","categoryId":1,"targetDate":"2026-12-31"}""")

        mockMvc.put("/api/goals/$id/weeks/2026-10-19") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"minutes":300}"""
        }.andExpect {
            status { isOk() }
            jsonPath("$.targetMinutes") { value(300) }
        }
        mockMvc.get("/api/plan/week?start=2026-10-19").andExpect {
            status { isOk() }
            jsonPath("$.goals[0].goal.title") { value("이력서 완성") }
            jsonPath("$.goals[0].goal.category.name") { value("이력서 작성") }
            jsonPath("$.targetMinutes") { value(300) }
        }
        mockMvc.patch("/api/goals/$id/status") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"status":"PAUSED"}"""
        }.andExpect { jsonPath("$.status") { value("PAUSED") } }
    }

    @Test
    fun `잘못된 요청은 공통 에러 형식으로 400을 반환한다`() {
        mockMvc.post("/api/goals") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"title":" ","categoryId":1}"""
        }.andExpect {
            status { isBadRequest() }
            jsonPath("$.fieldErrors[0].field") { value("title") }
        }
        val id = createGoal("""{"title":"이력서","categoryId":1}""")
        mockMvc.put("/api/goals/$id/weeks/2026-10-21") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"minutes":60}"""
        }.andExpect {
            status { isBadRequest() }
            jsonPath("$.code") { value("WEEK_START_NOT_MONDAY") }
        }
    }
}
