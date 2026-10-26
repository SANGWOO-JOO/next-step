package com.jobscheduler.ai

import com.jobscheduler.TestUsers
import com.jobscheduler.actual.ActualKind
import com.jobscheduler.actual.ActualLogService
import com.jobscheduler.actual.dto.ActualLogRequest
import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.daily.DailyGoalService
import com.jobscheduler.daily.dto.DailyGoalCreateRequest
import com.jobscheduler.focus.MutableClock
import com.jobscheduler.focus.TestClockConfig
import com.jobscheduler.goal.GoalService
import com.jobscheduler.goal.dto.GoalRequest
import com.jobscheduler.review.ReviewService
import com.jobscheduler.review.dto.AiFeedbackBlock
import com.jobscheduler.review.dto.WeeklyJournalRequest
import com.jobscheduler.user.UserService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.context.annotation.Primary
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** 진짜 Claude 대신 받은 입력을 남기고 정해 둔 답을 돌려준다 */
class FakeFeedbackClient : FeedbackClient {
    override var available = true
    val inputs = mutableListOf<String>()
    var answers = ArrayDeque<WeeklyFeedback>()

    override fun generate(system: String, input: String): WeeklyFeedback {
        inputs += input
        return answers.removeFirstOrNull() ?: WeeklyFeedback("이번 주 3시간 공부했어요", "기록한 날이 1일이에요", listOf("평일 저녁에 1시간 잡아 보세요"))
    }
}

@TestConfiguration
class FakeFeedbackClientConfig {
    @Bean
    @Primary
    fun fakeFeedbackClient() = FakeFeedbackClient()
}

/** AI 주간 피드백(docs/design.md 9-1, 2026-10-26 변경): 동의, 일지, 1시간, 하루 1회와 주 3회, 진행 중인 주, 보내는 내용, 말투 거르기 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Import(TestClockConfig::class, FakeFeedbackClientConfig::class)
class WeeklyFeedbackServiceTest(
    @Autowired private val service: WeeklyFeedbackService,
    @Autowired private val reviewService: ReviewService,
    @Autowired private val userService: UserService,
    @Autowired private val goalService: GoalService,
    @Autowired private val dailyGoalService: DailyGoalService,
    @Autowired private val actualLogService: ActualLogService,
    @Autowired private val client: FakeFeedbackClient,
    @Autowired private val clock: MutableClock,
) {
    private val monday = LocalDate.of(2026, 10, 19)
    private val day = LocalDate.of(2026, 10, 22)
    private fun at(h: Int) = OffsetDateTime.of(day.atTime(h, 0), ZoneOffset.ofHours(9))

    /** 목요일에 기록하고, 다음 주 화요일(주가 끝난 뒤)로 시계를 옮긴다 */
    private fun studied(hours: Int, minutes: Int = 0) {
        clock.instant = Instant.parse("2026-10-22T15:00:00Z")
        val goal = goalService.create(GoalRequest("기술 면접 준비", "#ec4899", icon = "tech-interview"))
        val todo = dailyGoalService.create(DailyGoalCreateRequest(goal.id, day, "기술 면접 준비"))
        actualLogService.create(ActualLogRequest(day, at(9), at(9 + hours).plusMinutes(minutes.toLong()), ActualKind.GOAL, dailyGoalId = todo.id, title = "운영체제 질문"))
        clock.instant = Instant.parse("2026-10-27T01:00:00Z")
    }

    private fun wroteJournal() = reviewService.saveJournal(monday, WeeklyJournalRequest(good = "운영체제 정리", bad = "주말에 못 함"))

    @BeforeEach
    fun setUp() {
        client.available = true
        client.inputs.clear()
        client.answers.clear()
    }

    @Test
    fun `동의하지 않았으면 만들지 않는다`() {
        studied(3)
        val e = assertThrows<BusinessRuleException> { service.create(monday) }
        assertEquals("AI_CONSENT_REQUIRED", e.code)
    }

    @Test
    fun `일지를 쓰고 기록이 1시간 넘으면 만들고 하루 1회, 주 3회까지 받는다`() {
        userService.setAiConsent(true)
        studied(3)
        wroteJournal()

        val first = service.create(monday)
        assertEquals(1, first.aiFeedback.count)
        assertEquals(AiFeedbackBlock.TODAY_DONE, first.aiFeedback.blocked)
        assertContains(first.aiSummary!!, "평일 저녁")
        assertEquals("AI_TODAY_DONE", assertThrows<BusinessRuleException> { service.create(monday) }.code)

        clock.instant = Instant.parse("2026-10-28T01:00:00Z")
        assertNull(reviewService.getJournal(monday).aiFeedback.blocked)
        service.create(monday)
        clock.instant = Instant.parse("2026-10-29T01:00:00Z")
        val third = service.create(monday)
        assertEquals(3, third.aiFeedback.count)
        assertEquals(AiFeedbackBlock.LIMIT, third.aiFeedback.blocked)
        clock.instant = Instant.parse("2026-10-30T01:00:00Z")
        assertEquals("AI_LIMIT", assertThrows<BusinessRuleException> { service.create(monday) }.code)
    }

    @Test
    fun `진행 중인 이번 주도 받을 수 있고 진행 중이라고 알린다`() {
        userService.setAiConsent(true)
        studied(3)
        wroteJournal()
        clock.instant = Instant.parse("2026-10-23T01:00:00Z") // 금요일, 그 주 안

        val result = service.create(monday)
        assertEquals(1, result.aiFeedback.count)
        assertContains(client.inputs.single(), "진행 중(5일째)")
    }

    @Test
    fun `보내는 내용에 목표, 세부 내용, 일지 글은 있고 이메일은 없다`() {
        userService.setAiConsent(true)
        studied(3)
        reviewService.saveJournal(monday, WeeklyJournalRequest(good = "운영체제 정리"))
        service.create(monday)
        assertContains(client.inputs.single(), "끝남")

        val input = client.inputs.single()
        assertContains(input, "기술 면접 준비")
        assertContains(input, "운영체제 질문")
        assertContains(input, "운영체제 정리")
        assertContains(input, "3시간")
        assertFalse(input.contains("@"))
    }

    @Test
    fun `일지가 없거나, 1시간 미만이거나, 시작 전 주이거나, 키가 없으면 막는다`() {
        userService.setAiConsent(true)
        studied(0, minutes = 50)
        assertEquals(AiFeedbackBlock.NO_JOURNAL, reviewService.getJournal(monday).aiFeedback.blocked)
        assertEquals("AI_NO_JOURNAL", assertThrows<BusinessRuleException> { service.create(monday) }.code)
        wroteJournal()
        assertEquals(AiFeedbackBlock.TOO_LITTLE, reviewService.getJournal(monday).aiFeedback.blocked)
        assertEquals(AiFeedbackBlock.NOT_STARTED, reviewService.getJournal(monday.plusWeeks(2)).aiFeedback.blocked)
        client.available = false
        assertEquals(AiFeedbackBlock.UNAVAILABLE, reviewService.getJournal(monday).aiFeedback.blocked)
        assertTrue(client.inputs.isEmpty())
    }

    @Test
    fun `중간 점은 지우고 없는 숫자가 나오면 한 번 다시 만든다`() {
        userService.setAiConsent(true)
        studied(3)
        wroteJournal()
        client.answers.addAll(
            listOf(
                WeeklyFeedback("이번 주 9시간 공부했어요", "꾸준했어요", listOf("저녁 공부")),
                WeeklyFeedback("면접 · 운영체제에 3시간 썼어요", "기록한 날이 1일이에요", listOf("주말 · 오전에 1시간")),
            ),
        )
        val result = service.create(monday)
        assertEquals(2, client.inputs.size)
        assertContains(result.aiSummary!!, "면접, 운영체제에 3시간")
        assertFalse(result.aiSummary!!.contains("·"))
    }

    @Test
    fun `동의는 끌 수 있다`() {
        assertTrue(userService.setAiConsent(true).aiAgreed)
        assertFalse(userService.setAiConsent(false).aiAgreed)
        TestUsers.loginAs(TestUsers.ME)
    }
}
