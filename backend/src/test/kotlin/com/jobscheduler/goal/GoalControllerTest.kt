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
import org.springframework.test.web.servlet.post
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class GoalControllerTest(
    @Autowired private val mockMvc: MockMvc,
    @Autowired private val objectMapper: ObjectMapper,
) {
    private fun postJson(path: String, body: String) = mockMvc.post(path) {
        contentType = MediaType.APPLICATION_JSON
        content = body
    }

    private fun createdId(path: String, body: String): Long {
        val json = postJson(path, body).andExpect { status { isCreated() } }.andReturn().response.contentAsString
        return objectMapper.readTree(json)["id"].asLong()
    }

    @Test
    fun `목표 트리를 만들고 조회한다`() {
        val goalId = createdId("/api/goals", """{"title":"이직","startDate":"2026-10-20","targetDate":"2027-03-31"}""")
        val monthlyId = createdId("/api/monthly-goals", """{"goalId":$goalId,"month":"2026-10","content":"이력서 완성"}""")
        createdId("/api/weekly-goals", """{"monthlyGoalId":$monthlyId,"weekStart":"2026-10-19","content":"경력기술서","categoryId":1}""")

        mockMvc.get("/api/goals/$goalId").andExpect {
            status { isOk() }
            jsonPath("$.status") { value("ACTIVE") }
            jsonPath("$.monthlyGoals[0].month") { value("2026-10") }
            jsonPath("$.monthlyGoals[0].weeklyGoals[0].category.name") { value("이력서 작성") }
            jsonPath("$.monthlyGoals[0].progress.total") { value(1) }
        }
        mockMvc.get("/api/weekly-goals?weekStart=2026-10-19").andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(1) }
        }
        mockMvc.get("/api/monthly-goals?month=2026-10").andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(1) }
        }
    }

    @Test
    fun `규칙 위반은 공통 에러 형식으로 400을 반환한다`() {
        val goalId = createdId("/api/goals", """{"title":"이직","startDate":"2026-10-20","targetDate":"2027-03-31"}""")
        val monthlyId = createdId("/api/monthly-goals", """{"goalId":$goalId,"month":"2026-10","content":"이력서 완성"}""")

        postJson("/api/weekly-goals", """{"monthlyGoalId":$monthlyId,"weekStart":"2026-10-21","content":"경력기술서"}""")
            .andExpect {
                status { isBadRequest() }
                jsonPath("$.code") { value("WEEK_START_NOT_MONDAY") }
            }
    }
}
