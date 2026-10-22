package com.jobscheduler.review

import com.jobscheduler.category.CategoryService
import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.focus.MutableClock
import com.jobscheduler.focus.TestClockConfig
import com.jobscheduler.goal.GoalService
import com.jobscheduler.goal.MonthlyGoalService
import com.jobscheduler.goal.WeeklyGoalService
import com.jobscheduler.goal.dto.GoalRequest
import com.jobscheduler.goal.dto.MonthlyGoalCreateRequest
import com.jobscheduler.goal.dto.WeeklyGoalCreateRequest
import com.jobscheduler.goal.dto.WeeklyGoalUpdateRequest
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
    @Autowired private val monthlyGoalService: MonthlyGoalService,
    @Autowired private val weeklyGoalService: WeeklyGoalService,
    @Autowired private val clock: MutableClock,
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
    fun `월간 회고는 주차별 주간 목표 달성과 일지 작성 여부를 함께 준다`() {
        val goal = goalService.create(
            GoalRequest(title = "이직", startDate = LocalDate.of(2026, 10, 1), targetDate = LocalDate.of(2027, 3, 31)),
        )
        val monthly = monthlyGoalService.create(MonthlyGoalCreateRequest(goal.id, YearMonth.of(2026, 10), "이력서"))
        val weekly = weeklyGoalService.create(WeeklyGoalCreateRequest(monthly.id, monday, "경력기술서"))
        weeklyGoalService.create(WeeklyGoalCreateRequest(monthly.id, monday, "자소서"))
        weeklyGoalService.update(weekly.id, WeeklyGoalUpdateRequest(monday, "경력기술서", null, true))
        reviewService.saveJournal(monday, WeeklyJournalRequest(good = "좋음"))

        val review = reviewService.saveReview(YearMonth.of(2026, 10), MonthlyReviewRequest(review = "이력서 완성", nextDirection = "면접"))
        assertTrue(review.saved)
        val week = review.weeks.first { it.weekStart == monday }
        assertEquals(1, week.weeklyGoalsAchieved)
        assertEquals(2, week.weeklyGoalsTotal)
        assertTrue(week.journalWritten)
        assertFalse(review.weeks.first().journalWritten)
    }
}
