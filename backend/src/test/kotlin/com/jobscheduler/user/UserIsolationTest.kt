package com.jobscheduler.user

import com.jobscheduler.TestUsers
import com.jobscheduler.actual.ActualKind
import com.jobscheduler.actual.ActualLogService
import com.jobscheduler.actual.dto.ActualLogRequest
import com.jobscheduler.category.CategoryService
import com.jobscheduler.category.dto.CategoryRequest
import com.jobscheduler.common.NotFoundException
import com.jobscheduler.daily.DailyGoalService
import com.jobscheduler.daily.dto.DailyGoalCreateRequest
import com.jobscheduler.goal.GoalService
import com.jobscheduler.goal.dto.GoalRequest
import com.jobscheduler.record.DailyLogService
import com.jobscheduler.record.dto.DailyLogRequest
import com.jobscheduler.timeblock.TimeBlockService
import com.jobscheduler.timeblock.dto.TimeBlockRequest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.security.test.context.TestSecurityContextHolder
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * 사용자 분리(docs/design.md 11-6 2-1). 사용자 2가 만든 데이터를 사용자 1은 목록에서 못 보고,
 * id로 찔러도 404(NotFoundException)여야 한다. 트랜잭션을 걸지 않아 서비스 호출마다 그때의 사용자로 세션이 열린다.
 * 데이터는 사용자 2 것만 만들어서 사용자 1 기준의 다른 테스트에 영향이 없다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class UserIsolationTest(
    @Autowired private val mockMvc: MockMvc,
    @Autowired private val userService: UserService,
    @Autowired private val categoryService: CategoryService,
    @Autowired private val goalService: GoalService,
    @Autowired private val dailyGoalService: DailyGoalService,
    @Autowired private val timeBlockService: TimeBlockService,
    @Autowired private val actualLogService: ActualLogService,
    @Autowired private val dailyLogService: DailyLogService,
) {
    private val day = LocalDate.of(2031, 3, 3)
    private val monday = day // 2031-03-03은 월요일
    private fun at(hour: Int) = OffsetDateTime.of(2031, 3, 3, hour, 0, 0, 0, ZoneOffset.ofHours(9))

    /** 테스트 데이터의 사용자 2 분류 */
    private val otherCategoryId = 7L

    @Test
    fun `다른 사용자의 데이터는 목록에 안 보이고 id로 고치거나 지울 수 없다`() {
        TestUsers.loginAs(TestUsers.OTHER)
        val goal = goalService.create(GoalRequest(title = "이력서 작성", color = "#2563eb"))
        val daily = dailyGoalService.create(DailyGoalCreateRequest(date = day, content = "남의 할 일", categoryId = otherCategoryId))
        val block = timeBlockService.create(TimeBlockRequest(daily.id, startAt = at(9), endAt = at(10)))
        val log = actualLogService.create(ActualLogRequest(day, at(11), at(12), ActualKind.STUDY, categoryId = otherCategoryId)).single()
        dailyLogService.save(day, DailyLogRequest(memo = "남의 메모"))

        TestUsers.loginAs(TestUsers.ME)
        assertTrue(goalService.list().none { it.id == goal.id })
        assertTrue(goalService.week(monday).goals.none { it.goal.id == goal.id })
        assertTrue(dailyGoalService.list(day, day).isEmpty())
        assertTrue(timeBlockService.list(day, day).isEmpty())
        assertTrue(actualLogService.list(day, day).isEmpty())
        assertNull(dailyLogService.get(day).memo)
        assertTrue(categoryService.list(includeInactive = true).none { it.id == otherCategoryId })

        assertThrows<NotFoundException> { goalService.get(goal.id) }
        assertThrows<NotFoundException> { goalService.delete(goal.id) }
        // 남의 목표에 내 할 일을 묶을 수도 없다
        assertThrows<NotFoundException> {
            dailyGoalService.create(DailyGoalCreateRequest(goalId = goal.id, date = day, content = "몰래"))
        }
        assertThrows<NotFoundException> { dailyGoalService.delete(daily.id) }
        assertThrows<NotFoundException> { timeBlockService.delete(block.id) }
        assertThrows<NotFoundException> { actualLogService.delete(log.id) }
        assertThrows<NotFoundException> { categoryService.delete(otherCategoryId) }
        // 남의 분류로 내 할 일을 만들 수도 없다
        assertThrows<NotFoundException> {
            dailyGoalService.create(DailyGoalCreateRequest(date = day, content = "몰래", categoryId = otherCategoryId))
        }

        // API로도 404
        mockMvc.get("/api/goals/${goal.id}").andExpect { status { isNotFound() } }

        // 사용자 2의 데이터는 그대로 남아 있다
        TestUsers.loginAs(TestUsers.OTHER)
        assertEquals("남의 할 일", dailyGoalService.list(day, day).single().content)
    }

    @Test
    fun `분류 이름은 사용자마다 따로 겹치지 않으면 된다`() {
        TestUsers.loginAs(TestUsers.OTHER)
        // 사용자 1에게 이미 있는 이름
        val created = categoryService.create(CategoryRequest(name = "CS 공부", color = "#16a34a"))
        assertEquals("CS 공부", created.name)
    }

    @Test
    fun `로그인 안 하면 API는 401이고 로그인하면 내 정보를 돌려준다`() {
        TestSecurityContextHolder.clearContext()
        mockMvc.get("/api/categories").andExpect { status { isUnauthorized() } }
        mockMvc.get("/api/health").andExpect { status { isOk() } }

        TestUsers.loginAs(TestUsers.ME)
        mockMvc.get("/api/me").andExpect {
            status { isOk() }
            jsonPath("$.email") { value("user1@example.com") }
        }
    }

    @Test
    fun `처음 로그인하면 사용자와 기타 분류가 생기고 다시 로그인하면 이름만 갱신된다`() {
        val first = userService.signIn("google-new-1", "new@example.com", "새 사람", null)
        val names = CurrentUser.runAs(first.id!!) { categoryService.list(includeInactive = true).map { it.name } }
        assertEquals(listOf("기타"), names)

        val again = userService.signIn("google-new-1", "new@example.com", "바뀐 이름", "https://example.com/p.png")
        assertEquals(first.id, again.id)
        assertEquals("바뀐 이름", again.name)
        val count = CurrentUser.runAs(first.id!!) { categoryService.list(includeInactive = true).size }
        assertEquals(1, count)
    }
}
