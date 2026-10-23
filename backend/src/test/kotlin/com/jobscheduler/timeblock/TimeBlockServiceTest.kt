package com.jobscheduler.timeblock

import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.daily.DailyGoalService
import com.jobscheduler.daily.dto.DailyGoalCreateRequest
import com.jobscheduler.daily.dto.DailyGoalResponse
import com.jobscheduler.goal.GoalService
import com.jobscheduler.goal.MonthlyGoalService
import com.jobscheduler.goal.WeeklyGoalService
import com.jobscheduler.goal.dto.GoalRequest
import com.jobscheduler.goal.dto.MonthlyGoalCreateRequest
import com.jobscheduler.goal.dto.WeeklyGoalCreateRequest
import com.jobscheduler.timeblock.dto.TimeBlockRequest
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertDoesNotThrow
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.YearMonth
import java.time.ZoneOffset
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class TimeBlockServiceTest(
    @Autowired private val timeBlockService: TimeBlockService,
    @Autowired private val dailyGoalService: DailyGoalService,
    @Autowired private val goalService: GoalService,
    @Autowired private val monthlyGoalService: MonthlyGoalService,
    @Autowired private val weeklyGoalService: WeeklyGoalService,
) {
    private val thursday = LocalDate.of(2026, 10, 22)
    private lateinit var resume: DailyGoalResponse
    private lateinit var cs: DailyGoalResponse

    /** 2026-10-22 서울 시각 */
    private fun at(hour: Int, minute: Int = 0, day: Int = 22) =
        OffsetDateTime.of(2026, 10, day, hour, minute, 0, 0, ZoneOffset.ofHours(9))

    @BeforeEach
    fun setUp() {
        val goal = goalService.create(
            GoalRequest(title = "이직", startDate = LocalDate.of(2026, 10, 20), targetDate = LocalDate.of(2027, 3, 31)),
        )
        val monthly = monthlyGoalService.create(MonthlyGoalCreateRequest(goal.id, YearMonth.of(2026, 10), "이력서"))
        val weekly = weeklyGoalService.create(WeeklyGoalCreateRequest(monthly.id, LocalDate.of(2026, 10, 19), "경력기술서", 1))
        resume = dailyGoalService.create(DailyGoalCreateRequest(weekly.id, thursday, "성과 정리"))
        cs = dailyGoalService.create(DailyGoalCreateRequest(weekly.id, thursday, "운영체제"))
    }

    private fun block(goal: DailyGoalResponse, start: OffsetDateTime, end: OffsetDateTime) =
        timeBlockService.create(TimeBlockRequest(goal.id, startAt = start, endAt = end))

    @Test
    fun `할 일 블록에 주제를 달고 같은 분류의 최근 주제를 겹치지 않게 돌려준다`() {
        val first = timeBlockService.create(TimeBlockRequest(cs.id, title = " 데이터 통신 ", startAt = at(9, 30), endAt = at(11)))
        assertEquals("데이터 통신", first.title)
        assertEquals("운영체제", first.label)
        timeBlockService.create(TimeBlockRequest(cs.id, title = "알고리즘", startAt = at(12, 30), endAt = at(14, 30)))
        timeBlockService.create(TimeBlockRequest(cs.id, title = "데이터 통신", startAt = at(15), endAt = at(16)))
        timeBlockService.create(TimeBlockRequest(cs.id, startAt = at(17), endAt = at(18)))

        val topics = timeBlockService.recentTopics(cs.category!!.id)
        assertEquals(listOf("데이터 통신", "알고리즘"), topics)
    }

    @Test
    fun `시간 블록을 만들고 시작 시각 순으로 조회한다`() {
        block(cs, at(14), at(15))
        val morning = block(resume, at(9), at(10, 30))

        val blocks = timeBlockService.list(thursday, thursday)
        assertEquals(listOf(morning.id, blocks[1].id), blocks.map { it.id })
        assertEquals("성과 정리", blocks[0].dailyGoalContent)
        assertEquals(thursday, blocks[0].date)
    }

    @Test
    fun `종료는 시작보다 늦어야 한다`() {
        val e = assertThrows<BusinessRuleException> { block(resume, at(10), at(10)) }
        assertEquals("INVALID_PERIOD", e.code)
    }

    @Test
    fun `하루 목표의 날짜 안에서만 잡을 수 있고 24시까지는 된다`() {
        val e = assertThrows<BusinessRuleException> { block(resume, at(23, day = 21), at(1)) }
        assertEquals("BLOCK_OUT_OF_DAY", e.code)
        assertDoesNotThrow { block(resume, at(23), at(0, day = 23)) }
    }

    @Test
    fun `같은 날 블록끼리 겹칠 수 없다`() {
        val first = block(resume, at(9), at(10))
        val e = assertThrows<BusinessRuleException> { block(cs, at(9, 30), at(10, 30)) }
        assertEquals("BLOCK_OVERLAP", e.code)

        // UTC로 보내도 같은 시각이면 겹친다
        val utc = assertThrows<BusinessRuleException> {
            block(cs, OffsetDateTime.of(2026, 10, 22, 0, 30, 0, 0, ZoneOffset.UTC), at(11))
        }
        assertEquals("BLOCK_OVERLAP", utc.code)

        assertDoesNotThrow { block(cs, at(10), at(11)) }
        // 자기 자신과는 겹침 검사를 하지 않는다
        assertDoesNotThrow { timeBlockService.update(first.id, TimeBlockRequest(resume.id, startAt = at(8, 30), endAt = at(10))) }
    }

    @Test
    fun `하루 목표를 지우거나 다른 날로 넘기면 블록도 지워진다`() {
        block(resume, at(9), at(10))
        block(resume, at(13), at(14))
        block(cs, at(15), at(16))

        val moved = dailyGoalService.move(resume.id, thursday.plusDays(1), null)
        assertEquals(2, moved.removedTimeBlocks)

        dailyGoalService.delete(cs.id)
        assertEquals(0, timeBlockService.list(thursday, thursday.plusDays(1)).size)
    }

    @Test
    fun `목표가 아닌 일정도 제목과 날짜로 넣을 수 있고 겹침 규칙은 같다`() {
        val lunch = timeBlockService.create(TimeBlockRequest(title = " 점심 ", date = thursday, startAt = at(12), endAt = at(13)))
        assertEquals("점심", lunch.label)
        assertEquals(null, lunch.dailyGoalId)

        val e = assertThrows<BusinessRuleException> { block(resume, at(12, 30), at(13, 30)) }
        assertEquals("BLOCK_OVERLAP", e.code)
        assertTrue(e.message!!.contains("점심"))

        val noTitle = assertThrows<BusinessRuleException> {
            timeBlockService.create(TimeBlockRequest(title = " ", date = thursday, startAt = at(14), endAt = at(15)))
        }
        assertEquals("GOAL_OR_TITLE_REQUIRED", noTitle.code)

        // 목표 블록을 일정으로 바꿀 수도 있다
        val b = block(resume, at(15), at(16))
        val changed = timeBlockService.update(b.id, TimeBlockRequest(title = "산책", date = thursday, startAt = at(15), endAt = at(16)))
        assertEquals("산책", changed.label)
        assertEquals(null, changed.dailyGoalId)
    }

    @Test
    fun `블록 색을 고르고 분류 색으로 되돌리며 시각을 옮겨도 색은 유지된다`() {
        val b = block(resume, at(9), at(10))
        val categoryBefore = b.category?.id

        val colored = timeBlockService.setColor(b.id, "#ff9f43")
        assertEquals("#FF9F43", colored.color)
        assertEquals(categoryBefore, colored.category?.id)

        val moved = timeBlockService.update(b.id, TimeBlockRequest(resume.id, startAt = at(11), endAt = at(12)))
        assertEquals("#FF9F43", moved.color)

        assertEquals("INVALID_COLOR", assertThrows<BusinessRuleException> { timeBlockService.setColor(b.id, "orange") }.code)
        assertEquals(null, timeBlockService.setColor(b.id, null).color)
    }
}
