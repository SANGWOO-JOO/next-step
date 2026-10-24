package com.jobscheduler.review

import com.jobscheduler.actual.ActualKind
import com.jobscheduler.actual.ActualLogService
import com.jobscheduler.actual.dto.ActualLogRequest
import com.jobscheduler.category.CategoryService
import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.focus.MutableClock
import com.jobscheduler.focus.TestClockConfig
import com.jobscheduler.goal.GoalService
import com.jobscheduler.goal.dto.GoalRequest
import com.jobscheduler.record.DailyLogService
import com.jobscheduler.record.ManualStudyLogService
import com.jobscheduler.record.dto.DailyLogRequest
import com.jobscheduler.record.dto.ManualStudyLogRequest
import com.jobscheduler.review.dto.MonthlyReviewRequest
import com.jobscheduler.review.dto.WeeklyJournalRequest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.YearMonth
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

@SpringBootTest
@ActiveProfiles("test")
@Import(TestClockConfig::class)
@Transactional
class ReviewServiceTest(
    @Autowired private val reviewService: ReviewService,
    @Autowired private val dailyLogService: DailyLogService,
    @Autowired private val manualLogService: ManualStudyLogService,
    @Autowired private val categoryService: CategoryService,
    @Autowired private val goalService: GoalService,
    @Autowired private val clock: MutableClock,
    @Autowired private val actualLogService: ActualLogService,
) {
    private val monday = LocalDate.of(2026, 10, 19)

    @Test
    fun `주간 일지는 주당 하나이고 저장 전에도 요일별 요약을 돌려준다`() {
        clock.instant = Instant.parse("2026-10-22T00:00:00Z")
        val categoryId = categoryService.list(includeInactive = false).first().id
        manualLogService.create(ManualStudyLogRequest(monday.plusDays(1), categoryId, 50))
        dailyLogService.save(monday.plusDays(1), DailyLogRequest(condition = 2))

        val empty = reviewService.getJournal(monday)
        assertFalse(empty.saved)
        assertEquals(7, empty.days.size)
        assertEquals(2, empty.days[1].condition)
        assertEquals(50, empty.total.manualMinutes)

        reviewService.saveJournal(monday, WeeklyJournalRequest(good = " 매일 시작함 ", bad = "", nextAction = "오전 집중"))
        val saved = reviewService.saveJournal(monday, WeeklyJournalRequest(good = "고침", nextAction = "오전 집중"))
        assertTrue(saved.saved)
        assertEquals("고침", saved.good)
        assertNull(saved.bad)
        assertTrue(saved.total.journalWritten)
    }

    @Test
    fun `주 시작일은 월요일이어야 한다`() {
        val e = assertThrows<BusinessRuleException> { reviewService.getJournal(monday.plusDays(1)) }
        assertEquals("WEEK_START_NOT_MONDAY", e.code)
    }

    @Test
    fun `월에 속한 주는 목요일 기준이다`() {
        // 2026-10-01은 목요일 → 9/28 주가 10월. 10/26 주의 목요일은 10/29 → 10월
        assertEquals(
            listOf(28 to 9, 5 to 10, 12 to 10, 19 to 10, 26 to 10),
            reviewService.mondaysOf(YearMonth.of(2026, 10)).map { it.dayOfMonth to it.monthValue },
        )
        // 2026-11-02 주부터 11월
        assertEquals(LocalDate.of(2026, 11, 2), reviewService.mondaysOf(YearMonth.of(2026, 11)).first())
    }

    @Test
    fun `월간 회고는 주차별 일지 작성 여부를 함께 준다`() {
        reviewService.saveJournal(monday, WeeklyJournalRequest(good = "좋음"))

        val review = reviewService.saveReview(YearMonth.of(2026, 10), MonthlyReviewRequest(review = "이력서 완성", nextDirection = "면접"))
        assertTrue(review.saved)
        val week = review.weeks.first { it.weekStart == monday }
        assertTrue(week.journalWritten)
        assertFalse(review.weeks.first().journalWritten)
    }

    @Test
    fun `저장된 월간 회고만 달 순서로 모아 준다`() {
        reviewService.saveReview(YearMonth.of(2026, 11), MonthlyReviewRequest(review = "11월"))
        reviewService.saveReview(YearMonth.of(2026, 10), MonthlyReviewRequest(review = "10월", nextDirection = "면접"))
        val list = reviewService.listReviews(YearMonth.of(2026, 9), YearMonth.of(2026, 12))
        assertEquals(listOf("10월", "11월"), list.map { it.review })
        assertEquals("면접", list[0].nextDirection)
    }

    @Test
    fun `저장된 주간 일지만 주 순서로 모아 준다`() {
        reviewService.saveJournal(monday, WeeklyJournalRequest(good = "둘째"))
        reviewService.saveJournal(monday.minusWeeks(1), WeeklyJournalRequest(good = "첫째"))
        val list = reviewService.listJournals(monday.minusWeeks(3), monday)
        assertEquals(listOf("첫째", "둘째"), list.map { it.good })
    }

    @Test
    fun `주 합계의 공부 시간은 실제 기록과 수동 기록을 더한다`() {
        clock.instant = Instant.parse("2026-10-22T00:00:00Z")
        val categoryId = categoryService.list(includeInactive = false).first().id
        val day = monday.plusDays(1)
        fun at(h: Int) = OffsetDateTime.of(2026, 10, 20, h, 0, 0, 0, ZoneOffset.ofHours(9))
        actualLogService.create(ActualLogRequest(day, at(9), at(10), ActualKind.STUDY, categoryId = categoryId))
        manualLogService.create(ManualStudyLogRequest(day, categoryId, 30))

        val total = reviewService.getJournal(monday).total
        assertEquals((60 + 30) * 60L, total.studySeconds)
        assertEquals((60 + 30) * 60L, reviewService.getReview(YearMonth.of(2026, 10)).weeks.first { it.weekStart == monday }.studySeconds)
    }
}
