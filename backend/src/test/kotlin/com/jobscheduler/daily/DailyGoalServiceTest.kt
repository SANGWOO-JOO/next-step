package com.jobscheduler.daily

import com.jobscheduler.category.CategoryService
import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.daily.dto.DailyGoalCreateRequest
import com.jobscheduler.daily.dto.DailyGoalResponse
import com.jobscheduler.daily.dto.DailyGoalUpdateRequest
import com.jobscheduler.goal.GoalService
import com.jobscheduler.goal.MonthlyGoalService
import com.jobscheduler.goal.WeeklyGoalService
import com.jobscheduler.goal.dto.GoalRequest
import com.jobscheduler.goal.dto.MonthlyGoalCreateRequest
import com.jobscheduler.goal.dto.WeeklyGoalCreateRequest
import com.jobscheduler.goal.dto.WeeklyGoalResponse
import com.jobscheduler.goal.dto.WeeklyGoalUpdateRequest
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
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class DailyGoalServiceTest(
    @Autowired private val dailyGoalService: DailyGoalService,
    @Autowired private val goalService: GoalService,
    @Autowired private val monthlyGoalService: MonthlyGoalService,
    @Autowired private val weeklyGoalService: WeeklyGoalService,
    @Autowired private val categoryService: CategoryService,
) {
    // 2026-10-19(월) ~ 10-25(일) 주, 다음 주는 10-26(월) ~ 11-01(일)
    private val thursday = LocalDate.of(2026, 10, 22)
    private val friday = LocalDate.of(2026, 10, 23)
    private val nextMonday = LocalDate.of(2026, 10, 26)

    private var resumeCategoryId = 0L
    private lateinit var thisWeek: WeeklyGoalResponse
    private lateinit var nextWeek: WeeklyGoalResponse

    @BeforeEach
    fun setUp() {
        val goal = goalService.create(
            GoalRequest(title = "이직", startDate = LocalDate.of(2026, 10, 20), targetDate = LocalDate.of(2027, 3, 31)),
        )
        val october = monthlyGoalService.create(
            MonthlyGoalCreateRequest(goalId = goal.id, month = YearMonth.of(2026, 10), content = "이력서 완성"),
        )
        val resume = categoryService.list(includeInactive = false).first { it.name == "이력서 작성" }
        resumeCategoryId = resume.id
        thisWeek = weeklyGoalService.create(
            WeeklyGoalCreateRequest(october.id, LocalDate.of(2026, 10, 19), "경력기술서 초안", resume.id),
        )
        nextWeek = weeklyGoalService.create(WeeklyGoalCreateRequest(october.id, nextMonday, "포트폴리오 정리"))
    }

    private fun create(
        content: String = "할 일",
        date: LocalDate = thursday,
        type: DailyGoalType? = null,
        categoryId: Long? = null,
        weeklyGoalId: Long? = thisWeek.id,
    ) = dailyGoalService.create(
        DailyGoalCreateRequest(weeklyGoalId, date, content, firstAction = "노션 열기", categoryId = categoryId, type = type),
    )

    private fun done(goal: DailyGoalResponse) = dailyGoalService.update(
        goal.id,
        DailyGoalUpdateRequest(goal.content, goal.firstAction, goal.category?.id, DailyGoalStatus.DONE),
    )

    @Test
    fun `분류를 고르지 않으면 주간 목표의 분류를 물려받는다`() {
        assertEquals(resumeCategoryId, create().category?.id)

        val cs = categoryService.list(includeInactive = false).first { it.name == "CS 공부" }
        assertEquals(cs.id, create(categoryId = cs.id).category?.id)

        // 주간 목표에도 분류가 없으면 미분류
        assertNull(create(date = nextMonday, weeklyGoalId = nextWeek.id).category)
    }

    @Test
    fun `핵심은 하루 3개까지이고 유형을 비우면 자리가 없을 때 추가로 들어간다`() {
        repeat(3) { assertEquals(DailyGoalType.CORE, create(content = "핵심 $it").type) }

        val e = assertThrows<BusinessRuleException> { create(type = DailyGoalType.CORE) }
        assertEquals("CORE_LIMIT", e.code)
        assertEquals(DailyGoalType.EXTRA, create().type)
    }

    @Test
    fun `날짜는 주간 목표의 주 안이어야 한다`() {
        val e = assertThrows<BusinessRuleException> { create(date = nextMonday) }
        assertEquals("DATE_NOT_IN_WEEK", e.code)
    }

    @Test
    fun `같은 주로 넘기면 주간 목표를 유지하고 넘긴 횟수가 늘어난다`() {
        val moved = dailyGoalService.move(create().id, friday, null)
        assertEquals(friday, moved.dailyGoal.date)
        assertEquals(thisWeek.id, moved.dailyGoal.weeklyGoalId)
        assertEquals(1, moved.dailyGoal.carryCount)
        assertFalse(moved.downgradedToExtra)
    }

    @Test
    fun `다른 주로 넘기면 연결이 풀리고 그 주의 주간 목표를 고르면 연결된다`() {
        val goal = create()
        val unlinked = dailyGoalService.move(goal.id, nextMonday, null)
        assertNull(unlinked.dailyGoal.weeklyGoalId)
        dailyGoalService.move(goal.id, thursday, thisWeek.id)

        val wrong = assertThrows<BusinessRuleException> { dailyGoalService.move(goal.id, friday, nextWeek.id) }
        assertEquals("DATE_NOT_IN_WEEK", wrong.code)

        val moved = dailyGoalService.move(goal.id, nextMonday, nextWeek.id)
        assertEquals(nextWeek.id, moved.dailyGoal.weeklyGoalId)
    }

    @Test
    fun `핵심이 꽉 찬 날로 넘기면 추가로 들어간다`() {
        repeat(3) { create(content = "금요일 핵심 $it", date = friday) }
        val moved = dailyGoalService.move(create().id, friday, null)
        assertEquals(DailyGoalType.EXTRA, moved.dailyGoal.type)
        assertTrue(moved.downgradedToExtra)
    }

    @Test
    fun `완료한 목표는 넘길 수 없다`() {
        val goal = done(create())
        val e = assertThrows<BusinessRuleException> { dailyGoalService.move(goal.id, friday, null) }
        assertEquals("ALREADY_DONE", e.code)
    }

    @Test
    fun `추가를 핵심으로 바꿀 때도 3개 제한을 지킨다`() {
        repeat(3) { create(content = "핵심 $it") }
        val extra = create(type = DailyGoalType.EXTRA)
        val e = assertThrows<BusinessRuleException> { dailyGoalService.changeType(extra.id, DailyGoalType.CORE) }
        assertEquals("CORE_LIMIT", e.code)

        val core = dailyGoalService.list(thursday, thursday).first { it.type == DailyGoalType.CORE }
        dailyGoalService.changeType(core.id, DailyGoalType.EXTRA)
        assertEquals(DailyGoalType.CORE, dailyGoalService.changeType(extra.id, DailyGoalType.CORE).type)
    }

    @Test
    fun `같은 날 같은 유형의 순서를 바꾼다`() {
        val ids = (1..3).map { create(content = "핵심 $it").id }
        dailyGoalService.reorder(thursday, DailyGoalType.CORE, ids.reversed())
        assertEquals(ids.reversed(), dailyGoalService.list(thursday, thursday).map { it.id })

        val e = assertThrows<BusinessRuleException> { dailyGoalService.reorder(thursday, DailyGoalType.CORE, ids.drop(1)) }
        assertEquals("INVALID_ORDER", e.code)
    }

    @Test
    fun `지난 날짜의 미완료 목표만 모은다`() {
        val todo = create(date = thursday)
        done(create(date = thursday))
        create(date = friday)

        assertEquals(listOf(todo.id), dailyGoalService.unfinished(before = friday).map { it.id })
    }

    @Test
    fun `하루 목표가 연결된 주간 목표는 삭제하거나 주를 바꿀 수 없다`() {
        create()
        val delete = assertThrows<BusinessRuleException> { weeklyGoalService.delete(thisWeek.id) }
        assertEquals("HAS_CHILDREN", delete.code)

        val update = assertThrows<BusinessRuleException> {
            weeklyGoalService.update(thisWeek.id, WeeklyGoalUpdateRequest(nextMonday, thisWeek.content, null))
        }
        assertEquals("HAS_CHILDREN", update.code)
    }

    @Test
    fun `주간 목표 없이 하루 목표를 만들고 나중에 연결하거나 풀 수 있다`() {
        val goal = create(weeklyGoalId = null)
        assertNull(goal.weeklyGoalId)
        assertNull(goal.category)

        val linked = dailyGoalService.link(goal.id, thisWeek.id)
        assertEquals(thisWeek.id, linked.weeklyGoalId)
        // 분류가 없던 목표는 주간 목표의 분류를 물려받는다
        assertEquals(resumeCategoryId, linked.category?.id)

        val wrong = assertThrows<BusinessRuleException> { dailyGoalService.link(goal.id, nextWeek.id) }
        assertEquals("DATE_NOT_IN_WEEK", wrong.code)

        val unlinked = dailyGoalService.link(goal.id, null)
        assertNull(unlinked.weeklyGoalId)
        assertEquals(resumeCategoryId, unlinked.category?.id)
    }
}
