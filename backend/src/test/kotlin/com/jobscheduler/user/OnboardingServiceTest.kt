package com.jobscheduler.user

import com.jobscheduler.TestUsers
import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.daily.DailyGoalService
import com.jobscheduler.focus.MutableClock
import com.jobscheduler.focus.TestClockConfig
import com.jobscheduler.goal.GoalService
import com.jobscheduler.goal.dto.GoalRequest
import com.jobscheduler.timeblock.TimeBlockService
import com.jobscheduler.user.dto.OnboardingBlock
import com.jobscheduler.user.dto.OnboardingRequest
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.test.context.ActiveProfiles
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * 시작 설정(docs/design.md 11-6 2-3). 사용자마다 한 번만 하므로 테스트마다 새 사용자로 로그인한다.
 * 트랜잭션을 걸지 않아 실패 때 되돌림(한 트랜잭션)도 확인한다.
 */
@SpringBootTest
@ActiveProfiles("test")
@Import(TestClockConfig::class)
class OnboardingServiceTest(
    @Autowired private val onboardingService: OnboardingService,
    @Autowired private val userService: UserService,
    @Autowired private val goalService: GoalService,
    @Autowired private val dailyGoalService: DailyGoalService,
    @Autowired private val timeBlockService: TimeBlockService,
    @Autowired private val clock: MutableClock,
) {
    // 2026-10-21(수) 09:00 서울. 이번 주는 10-19(월) ~ 10-25(일)
    private val monday = LocalDate.of(2026, 10, 19)
    private val wednesday = LocalDate.of(2026, 10, 21)
    private val friday = LocalDate.of(2026, 10, 23)

    private fun at(date: LocalDate, hour: Int) = OffsetDateTime.of(date.atTime(hour, 0), ZoneOffset.ofHours(9))
    private fun block(date: LocalDate, from: Int, to: Int) = OnboardingBlock(at(date, from), at(date, to))
    private fun request(vararg blocks: OnboardingBlock) =
        OnboardingRequest(true, UserPurpose.JOB_SEEKER, GoalRequest("코딩 테스트 합격", "#14b8a6", LocalDate.of(2027, 1, 31)), blocks.toList())

    @BeforeEach
    fun newUser() {
        clock.instant = Instant.parse("2026-10-21T00:00:00Z")
        val user = userService.signIn("google-${UUID.randomUUID()}", "new@example.com", "새 사람", null)
        TestUsers.loginAs(user.id!!)
    }

    @Test
    fun `목적과 첫 목표를 저장하고 칠한 칸을 날짜마다 할 일 하나와 블록으로 만든다`() {
        val me = onboardingService.complete(request(block(wednesday, 9, 12), block(wednesday, 20, 21), block(friday, 20, 21)))
        assertTrue(me.onboarded)
        assertEquals(UserPurpose.JOB_SEEKER, me.purpose)

        val goal = goalService.list().single()
        assertEquals("코딩 테스트 합격", goal.title)
        val dailies = dailyGoalService.list(monday, monday.plusDays(6))
        assertEquals(listOf(wednesday, friday), dailies.map { it.date })
        assertTrue(dailies.all { it.goalId == goal.id })
        assertEquals(3, timeBlockService.list(monday, monday.plusDays(6)).size)

        val again = assertThrows<BusinessRuleException> { onboardingService.complete(request()) }
        assertEquals("ALREADY_ONBOARDED", again.code)
    }

    @Test
    fun `칠한 칸이 없어도 목표만으로 마칠 수 있다`() {
        assertTrue(onboardingService.complete(request()).onboarded)
        assertEquals(1, goalService.list().size)
        assertTrue(timeBlockService.list(monday, monday.plusDays(6)).isEmpty())
    }

    @Test
    fun `지난 요일이나 다음 주 칸은 받지 않고 아무것도 저장하지 않는다`() {
        val past = assertThrows<BusinessRuleException> { onboardingService.complete(request(block(monday, 9, 10))) }
        assertEquals("BLOCK_OUT_OF_WEEK", past.code)
        assertThrows<BusinessRuleException> { onboardingService.complete(request(block(monday.plusDays(7), 9, 10))) }

        assertFalse(userService.me().onboarded)
        assertTrue(goalService.list().isEmpty())
    }

    @Test
    fun `주말에 시작해도 이번 주 남은 날만 칠한다`() {
        clock.instant = Instant.parse("2026-10-24T00:00:00Z") // 토요일
        val saturday = LocalDate.of(2026, 10, 24)
        assertEquals(saturday to saturday.plusDays(1), onboardingService.paintableDays())

        val nextWeek = assertThrows<BusinessRuleException> { onboardingService.complete(request(block(monday.plusWeeks(1), 9, 10))) }
        assertEquals("BLOCK_OUT_OF_WEEK", nextWeek.code)
        onboardingService.complete(request(block(saturday.plusDays(1), 20, 21)))
        assertEquals(saturday.plusDays(1), dailyGoalService.list(monday, monday.plusDays(6)).single().date)
    }

    @Test
    fun `약관에 동의하지 않으면 마칠 수도 건너뛸 수도 없다`() {
        val e = assertThrows<BusinessRuleException> {
            onboardingService.complete(OnboardingRequest(false, UserPurpose.JOB_SEEKER, GoalRequest("목표", "#14b8a6")))
        }
        assertEquals("TERMS_NOT_AGREED", e.code)
        assertThrows<BusinessRuleException> { onboardingService.skip(false) }
        assertFalse(userService.me().onboarded)
    }

    @Test
    fun `건너뛰면 아무것도 만들지 않고 시작 설정만 끝낸다`() {
        val me = onboardingService.skip(true)
        assertTrue(me.onboarded)
        assertEquals(null, me.purpose)
        assertTrue(goalService.list().isEmpty())
    }

    @Test
    fun `설정에서 준비 중인 것을 바꿀 수 있다`() {
        onboardingService.complete(OnboardingRequest(true, UserPurpose.JOB_SEEKER, GoalRequest("면접 준비", "#14b8a6")))
        assertEquals(UserPurpose.CAREER_CHANGER, userService.changePurpose(UserPurpose.CAREER_CHANGER).purpose)
        assertEquals(UserPurpose.CAREER_CHANGER, userService.me().purpose)
    }

    @Test
    fun `알림 설정은 기본이 모두 켜짐과 21시이고 바꿀 수 있다`() {
        onboardingService.complete(OnboardingRequest(true, UserPurpose.JOB_SEEKER, GoalRequest("면접 준비", "#14b8a6")))
        assertEquals(com.jobscheduler.user.dto.NotificationSettings(true, true, true, true, 21), userService.me().notifications)
        val changed = com.jobscheduler.user.dto.NotificationSettings(false, true, false, true, 23)
        assertEquals(changed, userService.changeNotifications(changed).notifications)
        assertEquals(changed, userService.me().notifications)
    }
}
