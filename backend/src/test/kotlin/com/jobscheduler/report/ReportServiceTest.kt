package com.jobscheduler.report

import com.jobscheduler.actual.ActualKind
import com.jobscheduler.actual.ActualLogService
import com.jobscheduler.actual.dto.ActualLogRequest
import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.daily.DailyGoalService
import com.jobscheduler.daily.dto.DailyGoalCreateRequest
import com.jobscheduler.goal.GoalService
import com.jobscheduler.goal.dto.GoalRequest
import com.jobscheduler.timeblock.TimeBlockService
import com.jobscheduler.timeblock.dto.TimeBlockRequest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import kotlin.test.assertEquals

/** 내 공부 리포트(docs/design.md 11-6 2-8): 계획은 블록, 실제는 실제 기록, 목표별 많이 한 세부 내용 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ReportServiceTest(
    @Autowired private val service: ReportService,
    @Autowired private val goalService: GoalService,
    @Autowired private val dailyGoalService: DailyGoalService,
    @Autowired private val timeBlockService: TimeBlockService,
    @Autowired private val actualLogService: ActualLogService,
) {
    private val monday = LocalDate.of(2026, 10, 19)
    private fun at(day: LocalDate, h: Int, m: Int = 0) = OffsetDateTime.of(day.atTime(h, m), ZoneOffset.ofHours(9))

    private fun setUp(): Long {
        val wed = monday.plusDays(2)
        val thu = monday.plusDays(3)
        val goal = goalService.create(GoalRequest("기술 면접 준비", "#ec4899", icon = "tech-interview"))
        val todoWed = dailyGoalService.create(DailyGoalCreateRequest(goal.id, wed, "기술 면접 준비"))
        val todoThu = dailyGoalService.create(DailyGoalCreateRequest(goal.id, thu, "기술 면접 준비"))
        timeBlockService.create(TimeBlockRequest(todoWed.id, startAt = at(wed, 19), endAt = at(wed, 21)))
        actualLogService.create(ActualLogRequest(wed, at(wed, 19), at(wed, 21, 30), ActualKind.GOAL, dailyGoalId = todoWed.id, title = "운영체제"))
        actualLogService.create(ActualLogRequest(thu, at(thu, 20), at(thu, 21), ActualKind.GOAL, dailyGoalId = todoThu.id, title = "네트워크"))
        return goal.id
    }

    @Test
    fun `이번 주는 요일별 계획과 실제, 목표별 시간과 많이 한 세부 내용을 준다`() {
        val goalId = setUp()
        val r = service.report(ReportPeriod.WEEK, monday, monday.plusDays(5))
        assertEquals(210, r.actualMinutes)
        assertEquals(120, r.plannedMinutes)
        assertEquals(2, r.studyDays)
        assertEquals(7, r.buckets.size)
        assertEquals(ReportBucket(monday.plusDays(2), 120, 150), r.buckets[2])
        val goal = r.goals.first { it.id == goalId }
        assertEquals(210, goal.actualMinutes)
        assertEquals("운영체제", goal.topDetail)
        assertEquals("tech-interview", goal.icon)
    }

    @Test
    fun `이번 달은 주별로 묶고 지난 기간 실제와 비교한다`() {
        setUp()
        val r = service.report(ReportPeriod.MONTH, LocalDate.of(2026, 10, 24), monday.plusDays(5))
        assertEquals(LocalDate.of(2026, 10, 1), r.from)
        assertEquals(LocalDate.of(2026, 10, 31), r.to)
        assertEquals(210, r.buckets.first { it.start == monday }.actualMinutes)
        assertEquals(0, r.previousActualMinutes)
    }

    @Test
    fun `주 보기는 월요일이어야 한다`() {
        assertThrows<BusinessRuleException> { service.report(ReportPeriod.WEEK, monday.plusDays(1), monday) }
    }
}
