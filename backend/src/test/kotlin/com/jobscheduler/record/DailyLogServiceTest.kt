package com.jobscheduler.record

import com.jobscheduler.category.CategoryService
import com.jobscheduler.common.NotFoundException
import com.jobscheduler.daily.DailyGoalService
import com.jobscheduler.daily.DailyGoalStatus
import com.jobscheduler.daily.dto.DailyGoalCreateRequest
import com.jobscheduler.daily.dto.DailyGoalUpdateRequest
import com.jobscheduler.focus.FocusResult
import com.jobscheduler.focus.FocusSessionService
import com.jobscheduler.focus.InterruptionType
import com.jobscheduler.focus.MutableClock
import com.jobscheduler.focus.TestClockConfig
import com.jobscheduler.focus.dto.FocusStartRequest
import com.jobscheduler.focus.dto.InterruptionEndRequest
import com.jobscheduler.focus.dto.InterruptionStartRequest
import com.jobscheduler.goal.GoalService
import com.jobscheduler.goal.MonthlyGoalService
import com.jobscheduler.goal.WeeklyGoalService
import com.jobscheduler.goal.dto.GoalRequest
import com.jobscheduler.goal.dto.MonthlyGoalCreateRequest
import com.jobscheduler.goal.dto.WeeklyGoalCreateRequest
import com.jobscheduler.record.dto.DailyLogRequest
import com.jobscheduler.record.dto.ManualStudyLogRequest
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
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
class DailyLogServiceTest(
    @Autowired private val dailyLogService: DailyLogService,
    @Autowired private val manualLogService: ManualStudyLogService,
    @Autowired private val focusService: FocusSessionService,
    @Autowired private val dailyGoalService: DailyGoalService,
    @Autowired private val categoryService: CategoryService,
    @Autowired private val goalService: GoalService,
    @Autowired private val monthlyGoalService: MonthlyGoalService,
    @Autowired private val weeklyGoalService: WeeklyGoalService,
    @Autowired private val clock: MutableClock,
) {
    private val thursday = LocalDate.of(2026, 10, 22)
    private var categoryId = 0L
    private var weeklyId = 0L

    @BeforeEach
    fun setUp() {
        clock.instant = Instant.parse("2026-10-22T00:00:00Z")
        categoryId = categoryService.list(includeInactive = false).first().id
        val goal = goalService.create(
            GoalRequest(title = "이직", startDate = LocalDate.of(2026, 10, 1), targetDate = LocalDate.of(2027, 3, 31)),
        )
        val monthly = monthlyGoalService.create(MonthlyGoalCreateRequest(goal.id, YearMonth.of(2026, 10), "이력서"))
        weeklyId = weeklyGoalService.create(WeeklyGoalCreateRequest(monthly.id, LocalDate.of(2026, 10, 19), "경력기술서")).id
    }

    @Test
    fun `저장하지 않은 날도 자동 집계를 돌려주고 저장하면 같은 날 기록을 고친다`() {
        val empty = dailyLogService.get(thursday)
        assertFalse(empty.saved)
        assertEquals(0, empty.summary.focusSeconds)

        dailyLogService.save(thursday, DailyLogRequest(memo = " 오전에 집중 잘 됨 ", condition = 4))
        val saved = dailyLogService.save(thursday, DailyLogRequest(memo = "수정", condition = null))
        assertTrue(saved.saved)
        assertEquals("수정", saved.memo)
        assertNull(saved.condition)
    }

    @Test
    fun `하루 집계는 집중, 딴짓, 수동 기록, 목표 완료 수를 합친다`() {
        val a = dailyGoalService.create(DailyGoalCreateRequest(weeklyId, thursday, "성과 정리"))
        dailyGoalService.create(DailyGoalCreateRequest(weeklyId, thursday, "운영체제"))
        dailyGoalService.update(a.id, DailyGoalUpdateRequest(content = "성과 정리", status = DailyGoalStatus.DONE))

        val session = focusService.start(FocusStartRequest(categoryId = categoryId))
        clock.advance(Duration.ofMinutes(10))
        val s = focusService.startInterruption(session.id, InterruptionStartRequest())
        clock.advance(Duration.ofMinutes(3))
        focusService.endInterruption(session.id, s.interruptions[0].id, InterruptionEndRequest(InterruptionType.DISTRACTION))
        clock.advance(Duration.ofMinutes(5))
        focusService.end(session.id, FocusResult.MORE)

        manualLogService.create(ManualStudyLogRequest(thursday, categoryId, 40, "책"))
        manualLogService.create(ManualStudyLogRequest(thursday.plusDays(1), categoryId, 30))

        val summary = dailyLogService.get(thursday).summary
        assertEquals(15 * 60L, summary.focusSeconds)
        assertEquals(3 * 60L, summary.distractionSeconds)
        assertEquals(1, summary.sessionCount)
        assertEquals(40, summary.manualMinutes)
        assertEquals(1, summary.goalsDone)
        assertEquals(2, summary.goalsTotal)
    }

    @Test
    fun `수동 기록을 고치고 지우며 없는 분류는 거절한다`() {
        val log = manualLogService.create(ManualStudyLogRequest(thursday, categoryId, 30, "  "))
        assertNull(log.memo)
        val updated = manualLogService.update(log.id, ManualStudyLogRequest(thursday, categoryId, 45, "스터디"))
        assertEquals(45, updated.minutes)
        manualLogService.delete(log.id)
        assertEquals(0, manualLogService.list(thursday).size)
        assertThrows<NotFoundException> { manualLogService.create(ManualStudyLogRequest(thursday, 999_999, 30)) }
    }

    @Test
    fun `기록 목록은 기록이나 공부가 있는 날만 최신순으로 완료 목표와 함께 준다`() {
        dailyLogService.save(thursday.minusDays(2), DailyLogRequest(memo = "화요일", condition = 3))
        manualLogService.create(ManualStudyLogRequest(thursday, categoryId, 30))
        val goal = dailyGoalService.create(DailyGoalCreateRequest(weeklyId, thursday, "성과 정리"))
        dailyGoalService.update(goal.id, DailyGoalUpdateRequest(content = "성과 정리", status = DailyGoalStatus.DONE))

        val list = dailyLogService.list(thursday.minusDays(6), thursday)
        assertEquals(listOf(thursday, thursday.minusDays(2)), list.map { it.date })
        assertEquals(listOf("성과 정리"), list[0].doneGoals)
        assertEquals("화요일", list[1].memo)
    }
}
