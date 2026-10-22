package com.jobscheduler.health

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.OffsetDateTime
import java.time.ZoneId

@RestController
@RequestMapping("/api/health")
class HealthController(private val jdbcTemplate: JdbcTemplate) {

    data class HealthResponse(
        val status: String,
        val database: String,
        val serverTime: OffsetDateTime,
        val zone: String,
    )

    @GetMapping
    fun health(): HealthResponse {
        val db = runCatching { jdbcTemplate.queryForObject("SELECT 1", Int::class.java) }
            .fold({ "UP" }, { "DOWN" })
        return HealthResponse(
            status = "UP",
            database = db,
            serverTime = OffsetDateTime.now(),
            zone = ZoneId.systemDefault().id,
        )
    }
}
