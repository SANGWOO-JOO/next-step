package com.jobscheduler.goal

import com.jobscheduler.actual.ActualKind
import com.jobscheduler.actual.ActualLogService
import com.jobscheduler.actual.dto.ActualLogRequest
import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.daily.DailyGoalService
import com.jobscheduler.daily.dto.DailyGoalCreateRequest
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
import kotlin.test.assertNull

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class GoalServiceTest(
    @Autowired private val goalService: GoalService,
    @Autowired private val dailyGoalService: DailyGoalService,
    @Autowired private val timeBlockService: TimeBlockService,
    @Autowired private val actualLogService: ActualLogService,
) {
    // 테스트 데이터의 사용자 1 분류: 1 이력서 작성, 3 CS 공부
    private val monday = LocalDate.of(2026, 10, 19)
    private val thursday = LocalDate.of(2026, 10, 22)
    private fun at(hour: Int, minute: Int = 0) = OffsetDateTime.of(2026, 10, 22, hour, minute, 0, 0, ZoneOffset.ofHours(9))

    private fun goal(title: String, categoryId: Long = 1) = goalService.create(GoalRequest(title, categoryId))

    @Test
    fun `목표는 분류를 갖고 기한은 비워도 된다`() {
        val created = goalService.create(GoalRequest(" 이력서 완성 ", 1, LocalDate.of(2026, 12, 31)))
        assertEquals("이력서 완성", created.title)
        assertEquals("이력서 작성", created.category.name)
        assertEquals(GoalStatus.ACTIVE, created.status)

        val updated = goalService.update(created.id, GoalRequest("이력서·경력기술서", 3, null))
        assertEquals("CS 공부", updated.category.name)
        assertNull(updated.targetDate)
    }

    @Test
    fun `진행 중 목표는 3개까지이고 멈추면 자리가 생긴다`() {
        val first = goal("하나")
        goal("둘")
        goal("셋")
        val e = assertThrows<BusinessRuleException> { goal("넷") }
        assertEquals("ACTIVE_GOAL_LIMIT", e.code)

        goalService.changeStatus(first.id, GoalStatus.PAUSED)
        val fourth = goal("넷")
        // 다시 진행으로 돌릴 때도 개수를 본다
        assertThrows<BusinessRuleException> { goalService.changeStatus(first.id, GoalStatus.ACTIVE) }
        goalService.changeStatus(fourth.id, GoalStatus.DONE)
        assertEquals(GoalStatus.ACTIVE, goalService.changeStatus(first.id, GoalStatus.ACTIVE).status)
    }

    @Test
    fun `주 목표 시간은 주마다 따로 저장하고 다시 정하면 덮어쓴다`() {
        val resume = goal("이력서")
        goalService.setWeekMinutes(resume.id, monday, 300)
        goalService.setWeekMinutes(resume.id, monday, 240)
        goalService.setWeekMinutes(resume.id, monday.plusWeeks(1), 60)

        assertEquals(240, goalService.week(monday).goals.single().targetMinutes)
        assertEquals(60, goalService.week(monday.plusWeeks(1)).goals.single().targetMinutes)
        assertEquals(0, goalService.week(monday.minusWeeks(1)).goals.single().targetMinutes)

        val e = assertThrows<BusinessRuleException> { goalService.setWeekMinutes(resume.id, thursday, 60) }
        assertEquals("WEEK_START_NOT_MONDAY", e.code)
    }

    @Test
    fun `계획 화면은 목표마다 일정에 잡은 시간과 실제로 한 시간을 묶인 할 일로 센다`() {
        val resume = goal("이력서")
        val cs = goal("CS", 3)
        goalService.setWeekMinutes(resume.id, monday, 180)
        val daily = dailyGoalService.create(DailyGoalCreateRequest(resume.id, thursday, "경력기술서"))
        val loose = dailyGoalService.create(DailyGoalCreateRequest(null, thursday, "목표 없는 할 일"))
        timeBlockService.create(TimeBlockRequest(daily.id, startAt = at(9), endAt = at(11)))
        timeBlockService.create(TimeBlockRequest(loose.id, startAt = at(13), endAt = at(14)))
        actualLogService.create(ActualLogRequest(thursday, at(9), at(10, 30), ActualKind.GOAL, dailyGoalId = daily.id))
        actualLogService.create(ActualLogRequest(thursday, at(20), at(21), ActualKind.DISTRACTION, title = "유튜브"))

        val week = goalService.week(monday)
        val row = week.goals.first { it.goal.id == resume.id }
        assertEquals(180, row.targetMinutes)
        assertEquals(120, row.scheduledMinutes)
        assertEquals(90, row.actualMinutes)
        assertEquals(0, week.goals.first { it.goal.id == cs.id }.scheduledMinutes)
        assertEquals(120, week.scheduledMinutes)
        assertEquals(90, week.actualMinutes)
    }

    @Test
    fun `지난 목표는 그 주에 시간이 있을 때만 계획 화면에 나온다`() {
        val done = goal("끝난 목표")
        val dropped = goal("그만둔 목표")
        goalService.setWeekMinutes(done.id, monday, 60)
        goalService.changeStatus(done.id, GoalStatus.DONE)
        goalService.changeStatus(dropped.id, GoalStatus.DROPPED)

        assertEquals(listOf(done.id), goalService.week(monday).goals.map { it.goal.id })
        assertEquals(emptyList(), goalService.week(monday.plusWeeks(1)).goals)
    }
}
