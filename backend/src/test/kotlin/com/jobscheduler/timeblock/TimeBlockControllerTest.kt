package com.jobscheduler.timeblock

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
class TimeBlockControllerTest(
    @Autowired private val mockMvc: MockMvc,
    @Autowired private val objectMapper: ObjectMapper,
) {
    private var dailyGoalId = 0L

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
        val goalId = createdId("/api/goals", """{"title":"이력서 작성","color":"#2563eb"}""")
        val weeklyId = goalId
        dailyGoalId = createdId(
            "/api/daily-goals",
            """{"goalId":$weeklyId,"date":"2026-10-22","content":"성과 정리"}""",
        )
    }

    private fun blockBody(start: String, end: String) =
        """{"dailyGoalId":$dailyGoalId,"startAt":"2026-10-22T$start:00+09:00","endAt":"2026-10-22T$end:00+09:00"}"""

    @Test
    fun `시간 블록을 만들고 서울 시각으로 조회한다`() {
        createdId("/api/time-blocks", blockBody("09:00", "10:30"))
        mockMvc.get("/api/time-blocks?date=2026-10-22").andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(1) }
            jsonPath("$[0].startAt") { value("2026-10-22T09:00:00+09:00") }
            jsonPath("$[0].dailyGoalContent") { value("성과 정리") }
        }
    }

    @Test
    fun `겹치는 블록은 공통 에러 형식으로 400을 반환한다`() {
        createdId("/api/time-blocks", blockBody("09:00", "10:00"))
        postJson("/api/time-blocks", blockBody("09:30", "11:00")).andExpect {
            status { isBadRequest() }
            jsonPath("$.code") { value("BLOCK_OVERLAP") }
        }
    }
}
