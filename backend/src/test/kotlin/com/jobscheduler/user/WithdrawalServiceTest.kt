package com.jobscheduler.user

import com.jobscheduler.TestUsers
import com.jobscheduler.focus.MutableClock
import com.jobscheduler.focus.TestClockConfig
import com.jobscheduler.goal.GoalService
import com.jobscheduler.goal.dto.GoalRequest
import com.jobscheduler.user.dto.OnboardingBlock
import com.jobscheduler.user.dto.OnboardingRequest
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.ActiveProfiles
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** 회원 탈퇴(docs/design.md 11-6 2-4 ④): 그 사용자의 모든 기록과 계정이 지워지고 다른 사용자는 그대로 */
@SpringBootTest
@ActiveProfiles("test")
@Import(TestClockConfig::class)
class WithdrawalServiceTest(
    @Autowired private val withdrawalService: WithdrawalService,
    @Autowired private val onboardingService: OnboardingService,
    @Autowired private val userService: UserService,
    @Autowired private val goalService: GoalService,
    @Autowired private val jdbcTemplate: JdbcTemplate,
    @Autowired private val clock: MutableClock,
) {
    private fun count(table: String, userId: Long) =
        jdbcTemplate.queryForObject("SELECT COUNT(*) FROM $table WHERE user_id = ?", Long::class.java, userId)!!

    @Test
    fun `user_id가 있는 테이블은 모두 지우는 목록에 들어 있다`() {
        val tables = jdbcTemplate.queryForList(
            "SELECT LOWER(TABLE_NAME) FROM INFORMATION_SCHEMA.COLUMNS WHERE LOWER(COLUMN_NAME) = 'user_id' AND LOWER(TABLE_SCHEMA) = 'public'",
            String::class.java,
        ).toSet()
        assertEquals(tables, WithdrawalService.USER_TABLES.toSet())
    }

    @Test
    fun `탈퇴하면 그 사용자의 기록과 계정이 모두 지워지고 다른 사용자는 그대로다`() {
        clock.instant = Instant.parse("2026-10-21T00:00:00Z")
        val user = userService.signIn("google-${UUID.randomUUID()}", "bye@example.com", "떠나는 사람", null)
        val id = user.id!!
        TestUsers.loginAs(id)
        val day = LocalDate.of(2026, 10, 22)
        val at = { h: Int -> OffsetDateTime.of(day.atTime(h, 0), ZoneOffset.ofHours(9)) }
        onboardingService.complete(
            OnboardingRequest(true, UserPurpose.CAREER_CHANGER, GoalRequest("면접 준비", "#14b8a6"), listOf(OnboardingBlock(at(20), at(21)))),
        )
        assertTrue(count("time_block", id) > 0)

        TestUsers.loginAs(TestUsers.ME)
        val mine = goalService.list().size

        withdrawalService.withdraw(id)
        WithdrawalService.USER_TABLES.forEach { assertEquals(0, count(it, id), it) }
        assertEquals(0, jdbcTemplate.queryForObject("SELECT COUNT(*) FROM app_user WHERE id = ?", Long::class.java, id))
        assertEquals(mine, goalService.list().size)
    }
}
