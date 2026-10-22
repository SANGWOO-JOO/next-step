package com.jobscheduler.focus

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
class FocusSessionControllerTest(
    @Autowired private val mockMvc: MockMvc,
    @Autowired private val objectMapper: ObjectMapper,
) {
    private fun postJson(path: String, body: String) = mockMvc.post(path) {
        contentType = MediaType.APPLICATION_JSON
        content = body
    }

    @Test
    fun `진행 중 세션이 없으면 204, 분류만으로 시작하고 끝낸다`() {
        mockMvc.get("/api/focus-sessions/current").andExpect { status { isNoContent() } }

        val categoryId = objectMapper.readTree(mockMvc.get("/api/categories").andReturn().response.contentAsString)[0]["id"]
        val json = postJson("/api/focus-sessions", """{"categoryId":$categoryId}""")
            .andExpect {
                status { isCreated() }
                jsonPath("$.running") { value(true) }
                jsonPath("$.focusMinutes") { value(25) }
            }.andReturn().response.contentAsString
        val id = objectMapper.readTree(json)["id"].asLong()

        mockMvc.get("/api/focus-sessions/current").andExpect { jsonPath("$.id") { value(id) } }
        postJson("/api/focus-sessions", """{"categoryId":$categoryId}""").andExpect {
            status { isBadRequest() }
            jsonPath("$.code") { value("SESSION_ALREADY_RUNNING") }
        }
        postJson("/api/focus-sessions/$id/end", """{"result":"MORE"}""").andExpect {
            status { isOk() }
            jsonPath("$.running") { value(false) }
        }
    }

    @Test
    fun `집중 시간은 1분에서 180분 사이여야 한다`() {
        postJson("/api/focus-sessions", """{"categoryId":1,"focusMinutes":0}""").andExpect {
            status { isBadRequest() }
            jsonPath("$.code") { value("VALIDATION_FAILED") }
        }
    }
}
