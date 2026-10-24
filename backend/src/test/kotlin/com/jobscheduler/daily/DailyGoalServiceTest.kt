package com.jobscheduler.daily

import com.jobscheduler.category.CategoryService
import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.daily.dto.DailyGoalCreateRequest
import com.jobscheduler.daily.dto.DailyGoalResponse
import com.jobscheduler.daily.dto.DailyGoalUpdateRequest
import com.jobscheduler.goal.GoalService
import com.jobscheduler.goal.GoalStatus
import com.jobscheduler.goal.dto.GoalRequest
import com.jobscheduler.goal.dto.GoalResponse
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

@SpringBootTest
@ActiveProfiles("test")
@org.springframework.context.annotation.Import(com.jobscheduler.focus.TestClockConfig::class)
@Transactional
class DailyGoalServiceTest(
    @Autowired private val dailyGoalService: DailyGoalService,
    @Autowired private val goalService: GoalService,
    @Autowired private val categoryService: CategoryService,
    @Autowired private val clock: com.jobscheduler.focus.MutableClock,
) {
    private val thursday = LocalDate.of(2026, 10, 22)
    private val friday = LocalDate.of(2026, 10, 23)
    private val nextMonday = LocalDate.of(2026, 10, 26)

    private var resumeCategoryId = 0L
    private lateinit var resumeGoal: GoalResponse

    @BeforeEach
    fun setUp() {
        resumeCategoryId = categoryService.list(includeInactive = false).first { it.name == "이력서 작성" }.id
        resumeGoal = goalService.create(GoalRequest(title = "이력서 작성", color = "#2563eb"))
    }

    private fun create(
        content: String = "할 일",
        date: LocalDate = thursday,
        type: DailyGoalType? = null,
        categoryId: Long? = null,
        goalId: Long? = resumeGoal.id,
    ) = dailyGoalService.create(
        DailyGoalCreateRequest(goalId, date, content, firstAction = "노션 열기", categoryId = categoryId, type = type),
    )

    private fun done(goal: DailyGoalResponse) = dailyGoalService.update(
        goal.id,
        DailyGoalUpdateRequest(goal.content, goal.firstAction, goal.category?.id, DailyGoalStatus.DONE),
    )

    @Test
    fun `분류를 고르지 않으면 목표의 분류를 물려받는다`() {
        assertEquals(resumeCategoryId, create().category?.id)

        val cs = categoryService.list(includeInactive = false).first { it.name == "CS 공부" }
        assertEquals(cs.id, create(categoryId = cs.id).category?.id)

        // 목표에 묶지 않으면 미분류
        assertNull(create(goalId = null).category)
    }

    @Test
    fun `핵심은 하루 3개까지이고 유형을 비우면 자리가 없을 때 추가로 들어간다`() {
        repeat(3) { assertEquals(DailyGoalType.CORE, create(content = "핵심 $it").type) }

        val e = assertThrows<BusinessRuleException> { create(type = DailyGoalType.CORE) }
        assertEquals("CORE_LIMIT", e.code)
        assertEquals(DailyGoalType.EXTRA, create().type)
    }

    @Test
    fun `다른 주로 넘겨도 묶인 목표를 유지하고 넘긴 횟수가 늘어난다`() {
        val moved = dailyGoalService.move(create().id, nextMonday)
        assertEquals(nextMonday, moved.dailyGoal.date)
        assertEquals(resumeGoal.id, moved.dailyGoal.goalId)
        assertEquals(1, moved.dailyGoal.carryCount)
        assertFalse(moved.downgradedToExtra)
    }

    @Test
    fun `핵심이 꽉 찬 날로 넘기면 추가로 들어간다`() {
        repeat(3) { create(content = "금요일 핵심 $it", date = friday) }
        val moved = dailyGoalService.move(create().id, friday)
        assertEquals(DailyGoalType.EXTRA, moved.dailyGoal.type)
        assertTrue(moved.downgradedToExtra)
    }

    @Test
    fun `완료한 할 일은 넘길 수 없다`() {
        val goal = done(create())
        val e = assertThrows<BusinessRuleException> { dailyGoalService.move(goal.id, friday) }
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
    fun `목표를 지우면 할 일은 남고 연결만 풀린다`() {
        val daily = create()
        goalService.delete(resumeGoal.id)
        val left = dailyGoalService.list(thursday, thursday).single { it.id == daily.id }
        assertNull(left.goalId)
        assertEquals(resumeCategoryId, left.category?.id)
    }

    @Test
    fun `멈춘 목표에 묶인 할 일도 그대로 남는다`() {
        val daily = create()
        goalService.changeStatus(resumeGoal.id, GoalStatus.PAUSED)
        assertEquals(resumeGoal.id, dailyGoalService.list(thursday, thursday).single { it.id == daily.id }.goalId)
    }

    @Test
    fun `목표의 분류로 할 일을 만들면 진행 중일 때만 그 목표에 묶인다`() {
        assertEquals(resumeGoal.id, create(goalId = null, categoryId = resumeCategoryId).goalId)

        goalService.changeStatus(resumeGoal.id, GoalStatus.PAUSED)
        assertNull(create(goalId = null, categoryId = resumeCategoryId).goalId)
    }

    @Test
    fun `할 일을 먼저 만들고 나중에 같은 이름의 목표를 만들면 묶인다`() {
        // 이번 주(10-19 주)부터의 할 일만 묶는다
        clock.instant = java.time.Instant.parse("2026-10-21T00:00:00Z")
        val cs = categoryService.list(includeInactive = false).first { it.name == "CS 공부" }.id
        val loose = create(goalId = null, categoryId = cs)
        assertNull(loose.goalId)

        // 같은 이름의 분류("CS 공부")를 이어 쓰는 목표를 만들면 먼저 만든 할 일이 묶인다
        val csGoal = goalService.create(GoalRequest(title = "CS 공부", color = "#16a34a"))
        assertEquals(cs, csGoal.category.id)
        assertEquals(csGoal.id, dailyGoalService.list(thursday, thursday).single { it.id == loose.id }.goalId)
    }

    @Test
    fun `목표 없이 할 일을 만들고 나중에 묶거나 풀 수 있다`() {
        val goal = create(goalId = null)
        assertNull(goal.goalId)
        assertNull(goal.category)

        val linked = dailyGoalService.link(goal.id, resumeGoal.id)
        assertEquals(resumeGoal.id, linked.goalId)
        assertEquals("이력서 작성", linked.goalTitle)
        // 분류가 없던 할 일은 목표의 분류를 물려받는다
        assertEquals(resumeCategoryId, linked.category?.id)

        val unlinked = dailyGoalService.link(goal.id, null)
        assertNull(unlinked.goalId)
        assertEquals(resumeCategoryId, unlinked.category?.id)
    }
}
