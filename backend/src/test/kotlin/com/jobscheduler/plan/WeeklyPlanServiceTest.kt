package com.jobscheduler.plan

import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.daily.DailyGoalService
import com.jobscheduler.goal.GoalService
import com.jobscheduler.goal.MonthlyGoalService
import com.jobscheduler.goal.WeeklyGoalService
import com.jobscheduler.goal.dto.GoalRequest
import com.jobscheduler.goal.dto.MonthlyGoalCreateRequest
import com.jobscheduler.goal.dto.WeeklyGoalCreateRequest
import com.jobscheduler.goal.dto.WeeklyGoalResponse
import com.jobscheduler.goal.dto.WeeklyGoalUpdateRequest
import com.jobscheduler.plan.dto.WeeklyPlanCreateRequest
import com.jobscheduler.plan.dto.WeeklyPlanUpdateRequest
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.time.YearMonth
import kotlin.test.assertEquals

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class WeeklyPlanServiceTest(
    @Autowired private val planService: WeeklyPlanService,
    @Autowired private val weeklyGoalService: WeeklyGoalService,
    @Autowired private val goalService: GoalService,
    @Autowired private val monthlyGoalService: MonthlyGoalService,
    @Autowired private val dailyGoalService: DailyGoalService,
) {
    private val monday = LocalDate.of(2026, 10, 19)
    private lateinit var weekly: WeeklyGoalResponse

    @BeforeEach
    fun setUp() {
        val goal = goalService.create(
            GoalRequest(title = "이직", startDate = LocalDate.of(2026, 10, 1), targetDate = LocalDate.of(2027, 3, 31)),
        )
        val monthly = monthlyGoalService.create(MonthlyGoalCreateRequest(goal.id, YearMonth.of(2026, 10), "이력서"))
        weekly = weeklyGoalService.create(WeeklyGoalCreateRequest(monthly.id, monday, "경력기술서"))
    }

    private fun plan(date: LocalDate, content: String) =
        planService.create(WeeklyPlanCreateRequest(weekly.id, date, content))

    @Test
    fun `요일별 계획을 날짜와 순서대로 조회한다`() {
        plan(monday.plusDays(2), "성과 수치 찾기")
        plan(monday, "프로젝트 목록")
        plan(monday, "기술 스택 정리")

        val plans = planService.list(monday, monday.plusDays(6))
        assertEquals(listOf("프로젝트 목록", "기술 스택 정리", "성과 수치 찾기"), plans.map { it.content })
        assertEquals("경력기술서", plans[0].weeklyGoalContent)
    }

    @Test
    fun `계획 날짜는 주간 목표의 주 안이어야 한다`() {
        val e = assertThrows<BusinessRuleException> { plan(monday.plusDays(7), "다음 주") }
        assertEquals("DATE_OUT_OF_WEEK", e.code)

        val p = plan(monday, "월요일")
        val moved = planService.update(p.id, WeeklyPlanUpdateRequest(monday.plusDays(6), " 일요일 "))
        assertEquals("일요일", moved.content)
        assertThrows<BusinessRuleException> { planService.update(p.id, WeeklyPlanUpdateRequest(monday.minusDays(1), "x")) }
    }

    @Test
    fun `계획이 있으면 주간 목표의 주를 바꿀 수 없고 주간 목표를 지우면 계획도 지워진다`() {
        plan(monday, "프로젝트 목록")
        val e = assertThrows<BusinessRuleException> {
            weeklyGoalService.update(weekly.id, WeeklyGoalUpdateRequest(monday.plusDays(7), "경력기술서", null, false))
        }
        assertEquals("HAS_CHILDREN", e.code)

        weeklyGoalService.delete(weekly.id)
        assertEquals(0, planService.list(monday, monday.plusDays(6)).size)
    }
}
