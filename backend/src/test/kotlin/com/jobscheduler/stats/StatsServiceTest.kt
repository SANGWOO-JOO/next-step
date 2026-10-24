package com.jobscheduler.stats

import com.jobscheduler.actual.ActualKind
import com.jobscheduler.actual.ActualLogService
import com.jobscheduler.actual.dto.ActualLogRequest
import com.jobscheduler.category.CategoryService
import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.daily.DailyGoalService
import com.jobscheduler.daily.dto.DailyGoalCreateRequest
import com.jobscheduler.focus.FocusResult
import com.jobscheduler.focus.FocusSessionService
import com.jobscheduler.focus.InterruptionType
import com.jobscheduler.focus.MutableClock
import com.jobscheduler.focus.TestClockConfig
import com.jobscheduler.focus.dto.FocusStartRequest
import com.jobscheduler.focus.dto.InterruptionEndRequest
import com.jobscheduler.focus.dto.InterruptionStartRequest
import com.jobscheduler.goal.GoalService
import com.jobscheduler.goal.dto.GoalRequest
import com.jobscheduler.record.ManualStudyLogService
import com.jobscheduler.record.dto.ManualStudyLogRequest
import com.jobscheduler.stats.dto.StatsUnit
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.YearMonth
import java.time.ZoneOffset
import kotlin.test.assertEquals
import kotlin.test.assertNull

@SpringBootTest
@ActiveProfiles("test")
@Import(TestClockConfig::class)
@Transactional
class StatsServiceTest(
    @Autowired private val statsService: StatsService,
    @Autowired private val focusService: FocusSessionService,
    @Autowired private val manualLogService: ManualStudyLogService,
    @Autowired private val dailyGoalService: DailyGoalService,
    @Autowired private val categoryService: CategoryService,
    @Autowired private val goalService: GoalService,
    @Autowired private val clock: MutableClock,
    @Autowired private val actualLogService: ActualLogService,
) {
    private val thursday = LocalDate.of(2026, 10, 22)
    private val friday = thursday.plusDays(1)
    private var resumeId = 0L
    private var csId = 0L
    private var weeklyId = 0L

    private fun at(day: Int, hour: Int, minute: Int = 0) =
        OffsetDateTime.of(2026, 10, day, hour, minute, 0, 0, ZoneOffset.ofHours(9)).toInstant()

    private fun minutes(m: Long) = clock.advance(Duration.ofMinutes(m))

    @BeforeEach
    fun setUp() {
        val categories = categoryService.list(includeInactive = false)
        resumeId = categories.first { it.name == "이력서 작성" }.id
        csId = categories.first { it.name == "CS 공부" }.id
        val goal = goalService.create(GoalRequest(title = "이직", categoryId = resumeId))
        weeklyId = goal.id
    }

    /** start부터 focusMinutes 동안 집중하고 끝낸다 */
    private fun session(start: java.time.Instant, focusMinutes: Long, req: FocusStartRequest = FocusStartRequest(categoryId = csId)) {
        clock.instant = start
        val s = focusService.start(req)
        minutes(focusMinutes)
        focusService.end(s.id, FocusResult.MORE)
    }

    @Test
    fun `자정을 넘는 세션은 날짜별로 나뉘고 딴짓은 빠지며 공부 자료 찾기는 포함된다`() {
        // 목 23:30 시작 → 23:50~24:00 딴짓 → 00:00~00:10 공부 자료 → 00:40 종료
        clock.instant = at(22, 23, 30)
        val s = focusService.start(FocusStartRequest(categoryId = csId))
        minutes(20)
        var r = focusService.startInterruption(s.id, InterruptionStartRequest())
        minutes(10)
        focusService.endInterruption(s.id, r.interruptions[0].id, InterruptionEndRequest(InterruptionType.DISTRACTION))
        r = focusService.startInterruption(s.id, InterruptionStartRequest())
        minutes(10)
        focusService.endInterruption(s.id, r.interruptions[1].id, InterruptionEndRequest(InterruptionType.STUDY_MATERIAL))
        minutes(30)
        focusService.end(s.id, FocusResult.MORE)

        val thu = statsService.summary(thursday, thursday)
        assertEquals(20 * 60L, thu.focusSeconds)
        assertEquals(10 * 60L, thu.distractionSeconds)
        assertEquals(40 * 60L, statsService.summary(friday, friday).focusSeconds)

        val heat = statsService.heatmap(thursday, friday).cells.associate { (it.dayOfWeek to it.hour) to it.seconds }
        assertEquals(20 * 60L, heat[4 to 23])
        assertEquals(40 * 60L, heat[5 to 0])
    }

    @Test
    fun `분류는 세션, 할 일, 목표 순으로 정하고 없으면 미분류다`() {
        val daily = dailyGoalService.create(DailyGoalCreateRequest(weeklyId, thursday, "성과 정리"))
        // 하루 목표 분류(주간 목표에서 상속한 이력서 작성)
        session(at(22, 9), 30, FocusStartRequest(dailyGoalId = daily.id))
        // 세션 분류 CS
        session(at(22, 10), 20, FocusStartRequest(dailyGoalId = daily.id, categoryId = csId))
        manualLogService.create(ManualStudyLogRequest(thursday, csId, 10))

        val stats = statsService.byCategory(thursday, thursday).associateBy { it.category?.name }
        assertEquals(30 * 60L, stats["이력서 작성"]!!.seconds)
        assertEquals(30 * 60L, stats["CS 공부"]!!.seconds)
        assertEquals(0.5, stats["CS 공부"]!!.ratio)
        assertNull(stats[null])
        assertEquals(0L, stats["기타"]!!.seconds)
    }

    @Test
    fun `요약은 일평균과 딴짓 비율, 연속 공부일을 계산한다`() {
        session(at(20, 9), 30)
        manualLogService.create(ManualStudyLogRequest(LocalDate.of(2026, 10, 21), csId, 60))
        session(at(22, 9), 30)
        clock.instant = at(23, 8)

        // 금요일은 아직 공부 전이라 목요일부터 센다: 목, 수, 화 = 3일
        val week = statsService.summary(LocalDate.of(2026, 10, 19), friday)
        assertEquals(2 * 3600L, week.totalSeconds)
        assertEquals(3600L, week.manualSeconds)
        assertEquals(2 * 3600L / 5, week.dailyAverageSeconds)
        assertEquals(3, week.studyDays)
        assertEquals(3, week.streakDays)
        assertEquals(0.0, week.distractionRatio)
    }

    @Test
    fun `추이는 단위별로 빈 칸 없이 묶는다`() {
        session(at(20, 9), 30)
        session(at(27, 9), 15)
        val weeks = statsService.timeseries(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31), StatsUnit.WEEK)
        assertEquals(LocalDate.of(2026, 9, 28), weeks.buckets.first().start)
        assertEquals(5, weeks.buckets.size)
        assertEquals(30 * 60L, weeks.buckets.first { it.start == LocalDate.of(2026, 10, 19) }.totalSeconds)
        assertEquals(listOf("CS 공부"), weeks.categories.map { it.name })

        val days = statsService.timeseries(thursday, friday, StatsUnit.DAY)
        assertEquals(2, days.buckets.size)
    }

    @Test
    fun `기간은 731일 이내여야 한다`() {
        val e = assertThrows<BusinessRuleException> { statsService.summary(thursday, thursday.minusDays(1)) }
        assertEquals("INVALID_RANGE", e.code)
        assertThrows<BusinessRuleException> { statsService.summary(thursday, thursday.plusDays(731)) }
    }

    @Test
    fun `실제 기록이 있는 날은 실제 기록으로 세고 그날 집중 세션은 빼며 지난 세션은 그대로 센다`() {
        session(at(22, 10), 30)
        session(at(23, 9), 50)
        fun odt(h: Int, m: Int = 0) = OffsetDateTime.of(2026, 10, 23, h, m, 0, 0, ZoneOffset.ofHours(9))
        actualLogService.create(ActualLogRequest(friday, odt(9), odt(10), ActualKind.STUDY, categoryId = csId))
        actualLogService.create(ActualLogRequest(friday, odt(10), odt(10, 15), ActualKind.DISTRACTION, title = "유튜브"))
        actualLogService.create(ActualLogRequest(friday, odt(12), odt(13), ActualKind.OTHER, title = "점심"))

        val summary = statsService.summary(thursday, friday)
        assertEquals((30 + 60) * 60L, summary.focusSeconds)
        assertEquals(15 * 60L, summary.distractionSeconds)
        assertEquals(listOf(9), statsService.heatmap(friday, friday).cells.map { it.hour })
    }

    @Test
    fun `실제 공부 기록을 분류 안 주제별로 묶고 주제 없는 시간은 따로 둔다`() {
        fun odt(h: Int, m: Int = 0) = OffsetDateTime.of(2026, 10, 23, h, m, 0, 0, ZoneOffset.ofHours(9))
        actualLogService.create(ActualLogRequest(friday, odt(9), odt(11), ActualKind.STUDY, categoryId = csId, title = "알고리즘"))
        actualLogService.create(ActualLogRequest(friday, odt(12), odt(13), ActualKind.STUDY, categoryId = csId, title = "데이터 통신"))
        actualLogService.create(ActualLogRequest(friday, odt(14), odt(14, 30), ActualKind.STUDY, categoryId = csId))
        actualLogService.create(ActualLogRequest(friday, odt(15), odt(16), ActualKind.STUDY, categoryId = csId, title = "알고리즘 "))
        actualLogService.create(ActualLogRequest(friday, odt(16), odt(16, 15), ActualKind.DISTRACTION, title = "유튜브"))
        actualLogService.create(ActualLogRequest(friday, odt(17), odt(17, 30), ActualKind.STUDY, categoryId = csId, title = "CS 공부"))

        val cs = statsService.byTopic(friday, friday).single()
        assertEquals("CS 공부", cs.category?.name)
        assertEquals(5.0 * 3600, cs.seconds.toDouble())
        assertEquals(listOf("알고리즘" to 3 * 3600L, "데이터 통신" to 3600L, null to 3600L), cs.topics.map { it.title to it.seconds })
    }
}
