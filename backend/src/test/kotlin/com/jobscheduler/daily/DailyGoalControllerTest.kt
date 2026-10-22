package com.jobscheduler.daily

import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.BeforeEach
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
class DailyGoalControllerTest(
    @Autowired private val mockMvc: MockMvc,
    @Autowired private val objectMapper: ObjectMapper,
) {
    private var weeklyGoalId = 0L

    private fun postJson(path: String, body: String) = mockMvc.post(path) {
        contentType = MediaType.APPLICATION_JSON
        content = body
    }

    private fun createdId(path: String, body: String): Long {
        val json = postJson(path, body).andExpect { status { isCreated() } }.andReturn().response.contentAsString
        return objectMapper.readTree(json)["id"].asLong()
    }

    @BeforeEach
    fun setUp() {
        val goalId = createdId("/api/goals", """{"title":"이직","startDate":"2026-10-20","targetDate":"2027-03-31"}""")
        val monthlyId = createdId("/api/monthly-goals", """{"goalId":$goalId,"month":"2026-10","content":"이력서"}""")
        weeklyGoalId = createdId(
            "/api/weekly-goals",
            """{"monthlyGoalId":$monthlyId,"weekStart":"2026-10-19","content":"경력기술서","categoryId":1}""",
        )
    }

    private fun dailyBody(content: String, type: String? = null) =
        """{"weeklyGoalId":$weeklyGoalId,"date":"2026-10-22","content":"$content","firstAction":"노션 열기"""" +
            (type?.let { ""","type":"$it"""" } ?: "") + "}"

    @Test
    fun `하루 목표를 만들고 날짜로 조회한다`() {
        postJson("/api/daily-goals", dailyBody("성과 정리")).andExpect {
            status { isCreated() }
            jsonPath("$.type") { value("CORE") }
            jsonPath("$.category.name") { value("이력서 작성") }
            jsonPath("$.weeklyGoalContent") { value("경력기술서") }
        }
        mockMvc.get("/api/daily-goals?date=2026-10-22").andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(1) }
            jsonPath("$[0].firstAction") { value("노션 열기") }
        }
        mockMvc.get("/api/daily-goals/unfinished?before=2026-10-23").andExpect {
            jsonPath("$.length()") { value(1) }
        }
    }

    @Test
    fun `핵심 4번째는 공통 에러 형식으로 400을 반환한다`() {
        repeat(3) { createdId("/api/daily-goals", dailyBody("핵심 $it")) }
        postJson("/api/daily-goals", dailyBody("넷째", type = "CORE")).andExpect {
            status { isBadRequest() }
            jsonPath("$.code") { value("CORE_LIMIT") }
        }
    }

    @Test
    fun `넘기기는 넘긴 결과와 추가 전환 여부를 반환한다`() {
        val id = createdId("/api/daily-goals", dailyBody("성과 정리"))
        postJson("/api/daily-goals/$id/move", """{"date":"2026-10-23"}""").andExpect {
            status { isOk() }
            jsonPath("$.dailyGoal.date") { value("2026-10-23") }
            jsonPath("$.dailyGoal.carryCount") { value(1) }
            jsonPath("$.downgradedToExtra") { value(false) }
        }
    }
}
