package com.jobscheduler.goal

import com.jobscheduler.category.CategoryService
import com.jobscheduler.category.dto.CategoryRequest
import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.common.NotFoundException
import com.jobscheduler.goal.dto.GoalRequest
import com.jobscheduler.goal.dto.MonthlyGoalCreateRequest
import com.jobscheduler.goal.dto.MonthlyGoalUpdateRequest
import com.jobscheduler.goal.dto.Progress
import com.jobscheduler.goal.dto.WeeklyGoalCreateRequest
import com.jobscheduler.goal.dto.WeeklyGoalUpdateRequest
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
class GoalServiceTest(
    @Autowired private val goalService: GoalService,
    @Autowired private val monthlyGoalService: MonthlyGoalService,
    @Autowired private val weeklyGoalService: WeeklyGoalService,
    @Autowired private val categoryService: CategoryService,
) {
    private val october = YearMonth.of(2026, 10)
    private val november = YearMonth.of(2026, 11)

    private fun createGoal() = goalService.create(
        GoalRequest(
            title = "백엔드 개발자로 이직",
            startDate = LocalDate.of(2026, 10, 20),
            targetDate = LocalDate.of(2027, 3, 31),
        ),
    )

    private fun createMonthly(goalId: Long, month: YearMonth = october) =
        monthlyGoalService.create(MonthlyGoalCreateRequest(goalId = goalId, month = month, content = "이력서 완성"))

    private fun createWeekly(monthlyGoalId: Long, weekStart: LocalDate, categoryId: Long? = null) =
        weeklyGoalService.create(
            WeeklyGoalCreateRequest(monthlyGoalId = monthlyGoalId, weekStart = weekStart, content = "경력기술서", categoryId = categoryId),
        )

    @Test
    fun `진행률은 하위 목표 달성 비율로 계산된다`() {
        val goal = createGoal()
        val oct = createMonthly(goal.id, october)
        createMonthly(goal.id, november)
        val w1 = createWeekly(oct.id, LocalDate.of(2026, 10, 19))
        createWeekly(oct.id, LocalDate.of(2026, 10, 26))
        createWeekly(oct.id, LocalDate.of(2026, 9, 28)) // 목요일이 10월이라 10월 소속

        weeklyGoalService.update(w1.id, WeeklyGoalUpdateRequest(weekStart = w1.weekStart, content = w1.content, achieved = true))
        monthlyGoalService.update(oct.id, MonthlyGoalUpdateRequest(month = october, content = oct.content, achieved = true))

        val tree = goalService.get(goal.id)
        assertEquals(Progress(1, 2, 50), tree.progress)
        val octTree = tree.monthlyGoals.first { it.id == oct.id }
        assertEquals(Progress(1, 3, 33), octTree.progress)
        assertEquals(LocalDate.of(2026, 9, 28), octTree.weeklyGoals.first().weekStart)
        assertEquals(Progress(0, 0, 0), tree.monthlyGoals.first { it.month == november }.progress)
    }

    @Test
    fun `없는 상위 목표에는 연결할 수 없다`() {
        assertThrows<NotFoundException> { createMonthly(goalId = 999_999) }
        assertThrows<NotFoundException> { createWeekly(999_999, LocalDate.of(2026, 10, 19)) }
    }

    @Test
    fun `월간 목표는 최종 목표 기간 밖의 달로 만들 수 없다`() {
        val goal = createGoal()
        val e = assertThrows<BusinessRuleException> { createMonthly(goal.id, YearMonth.of(2026, 9)) }
        assertEquals("MONTH_OUT_OF_GOAL_PERIOD", e.code)
    }

    @Test
    fun `주간 목표는 월간 목표의 달에 속한 주여야 한다`() {
        val nov = createMonthly(createGoal().id, november)
        val e = assertThrows<BusinessRuleException> { createWeekly(nov.id, LocalDate.of(2026, 11, 30)) }
        assertEquals("WEEK_NOT_IN_MONTH", e.code)
    }

    @Test
    fun `연결된 주간 목표가 다른 달이 되도록 월간 목표의 달을 바꿀 수 없다`() {
        val oct = createMonthly(createGoal().id, october)
        createWeekly(oct.id, LocalDate.of(2026, 10, 19))
        val e = assertThrows<BusinessRuleException> {
            monthlyGoalService.update(oct.id, MonthlyGoalUpdateRequest(month = november, content = oct.content))
        }
        assertEquals("WEEK_NOT_IN_MONTH", e.code)
    }

    @Test
    fun `연결된 월간 목표가 기간 밖이 되도록 최종 목표 기간을 줄일 수 없다`() {
        val goal = createGoal()
        createMonthly(goal.id, YearMonth.of(2027, 3))
        val e = assertThrows<BusinessRuleException> {
            goalService.update(
                goal.id,
                GoalRequest(title = goal.title, startDate = goal.startDate, targetDate = LocalDate.of(2027, 2, 28)),
            )
        }
        assertEquals("MONTH_OUT_OF_GOAL_PERIOD", e.code)
    }

    @Test
    fun `하위 목표가 있으면 삭제할 수 없다`() {
        val goal = createGoal()
        val oct = createMonthly(goal.id)
        val weekly = createWeekly(oct.id, LocalDate.of(2026, 10, 19))

        assertEquals("HAS_CHILDREN", assertThrows<BusinessRuleException> { goalService.delete(goal.id) }.code)
        assertEquals("HAS_CHILDREN", assertThrows<BusinessRuleException> { monthlyGoalService.delete(oct.id) }.code)

        weeklyGoalService.delete(weekly.id)
        monthlyGoalService.delete(oct.id)
        goalService.delete(goal.id)
        assertThrows<NotFoundException> { goalService.get(goal.id) }
    }

    @Test
    fun `비활성 분류는 새로 지정할 수 없지만 이미 지정된 분류는 유지된다`() {
        val oct = createMonthly(createGoal().id)
        val category = categoryService.list(includeInactive = false).first()
        val weekly = createWeekly(oct.id, LocalDate.of(2026, 10, 19), category.id)

        categoryService.update(category.id, CategoryRequest(name = category.name, color = category.color, active = false))

        val kept = weeklyGoalService.update(
            weekly.id,
            WeeklyGoalUpdateRequest(weekStart = weekly.weekStart, content = "수정", categoryId = category.id),
        )
        assertEquals(category.id, kept.category?.id)

        val e = assertThrows<BusinessRuleException> { createWeekly(oct.id, LocalDate.of(2026, 10, 26), category.id) }
        assertEquals("CATEGORY_INACTIVE", e.code)
    }

    @Test
    fun `못 끝낸 주간 목표를 다음 주로 이어가고 달이 바뀌면 월간 목표를 골라야 한다`() {
        val goal = createGoal()
        val oct = createMonthly(goal.id, october)
        val nov = createMonthly(goal.id, november)
        val w = createWeekly(oct.id, LocalDate.of(2026, 10, 19))

        val next = weeklyGoalService.carryOver(w.id, null)
        assertEquals(LocalDate.of(2026, 10, 26), next.weekStart)
        assertEquals("경력기술서", next.content)
        val again = assertThrows<BusinessRuleException> { weeklyGoalService.carryOver(w.id, null) }
        assertEquals("ALREADY_CARRIED", again.code)

        // 10/26 주의 다음 주(11/2)는 11월이라 11월 월간 목표가 필요하다
        val e = assertThrows<BusinessRuleException> { weeklyGoalService.carryOver(next.id, null) }
        assertEquals("MONTHLY_GOAL_REQUIRED", e.code)
        assertEquals(nov.id, weeklyGoalService.carryOver(next.id, nov.id).monthlyGoalId)
        assertEquals(true, weeklyGoalService.list(oct.id, null).first { it.id == w.id }.carriedOver)
    }
}
