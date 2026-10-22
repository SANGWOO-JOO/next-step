package com.jobscheduler.focus

import com.jobscheduler.category.CategoryService
import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.daily.DailyGoalService
import com.jobscheduler.daily.DailyGoalStatus
import com.jobscheduler.daily.dto.DailyGoalCreateRequest
import com.jobscheduler.daily.dto.DailyGoalResponse
import com.jobscheduler.focus.dto.FocusStartRequest
import com.jobscheduler.focus.dto.InterruptionEndRequest
import com.jobscheduler.focus.dto.InterruptionStartRequest
import com.jobscheduler.goal.GoalService
import com.jobscheduler.goal.MonthlyGoalService
import com.jobscheduler.goal.WeeklyGoalService
import com.jobscheduler.goal.dto.GoalRequest
import com.jobscheduler.goal.dto.MonthlyGoalCreateRequest
import com.jobscheduler.goal.dto.WeeklyGoalCreateRequest
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
class FocusSessionServiceTest(
    @Autowired private val focusService: FocusSessionService,
    @Autowired private val noteService: DistractionNoteService,
    @Autowired private val dailyGoalService: DailyGoalService,
    @Autowired private val categoryService: CategoryService,
    @Autowired private val goalService: GoalService,
    @Autowired private val monthlyGoalService: MonthlyGoalService,
    @Autowired private val weeklyGoalService: WeeklyGoalService,
    @Autowired private val clock: MutableClock,
) {
    private val thursday = LocalDate.of(2026, 10, 22)
    private lateinit var resume: DailyGoalResponse
    private var csCategoryId = 0L

    @BeforeEach
    fun setUp() {
        // 2026-10-22 09:00 서울
        clock.instant = Instant.parse("2026-10-22T00:00:00Z")
        val categories = categoryService.list(includeInactive = false)
        csCategoryId = categories.first { it.name == "CS 공부" }.id
        val goal = goalService.create(
            GoalRequest(title = "이직", startDate = LocalDate.of(2026, 10, 20), targetDate = LocalDate.of(2027, 3, 31)),
        )
        val monthly = monthlyGoalService.create(MonthlyGoalCreateRequest(goal.id, YearMonth.of(2026, 10), "이력서"))
        val weekly = weeklyGoalService.create(
            WeeklyGoalCreateRequest(monthly.id, LocalDate.of(2026, 10, 19), "경력기술서", categories.first().id),
        )
        resume = dailyGoalService.create(DailyGoalCreateRequest(weekly.id, thursday, "성과 정리", firstAction = "문서 열기"))
    }

    private fun minutes(m: Long) = clock.advance(Duration.ofMinutes(m))

    private fun startResume() = focusService.start(FocusStartRequest(dailyGoalId = resume.id))

    @Test
    fun `하루 목표로 시작하면 분류를 물려받고 진행 중 세션으로 조회된다`() {
        val session = startResume()
        assertEquals(resume.category?.id, session.category?.id)
        assertEquals(thursday, session.date)
        assertEquals(25, session.focusMinutes)
        assertEquals(5, session.breakMinutes)
        assertEquals("문서 열기", session.dailyGoal?.firstAction)
        assertEquals(session.id, focusService.current()?.id)
    }

    @Test
    fun `하루 목표 없이 분류만으로 시작할 수 있지만 둘 다 없으면 안 된다`() {
        val e = assertThrows<BusinessRuleException> { focusService.start(FocusStartRequest()) }
        assertEquals("GOAL_OR_CATEGORY_REQUIRED", e.code)

        val session = focusService.start(FocusStartRequest(categoryId = csCategoryId, focusMinutes = 50, breakMinutes = 10))
        assertNull(session.dailyGoal)
        assertEquals(csCategoryId, session.category?.id)
        assertEquals(50, session.focusMinutes)
    }

    @Test
    fun `진행 중 세션은 하나뿐이다`() {
        val first = startResume()
        val e = assertThrows<BusinessRuleException> { focusService.start(FocusStartRequest(categoryId = csCategoryId)) }
        assertEquals("SESSION_ALREADY_RUNNING", e.code)

        focusService.end(first.id, FocusResult.MORE)
        assertNull(focusService.current())
        focusService.start(FocusStartRequest(categoryId = csCategoryId))
    }

    @Test
    fun `실제 집중 시간은 딴짓과 휴식을 빼고 공부 자료 찾기는 포함한다`() {
        val session = startResume()
        minutes(5)
        var s = focusService.startInterruption(session.id, InterruptionStartRequest())
        minutes(3)
        focusService.endInterruption(session.id, s.interruptions[0].id, InterruptionEndRequest(InterruptionType.DISTRACTION))
        minutes(5)
        s = focusService.startInterruption(session.id, InterruptionStartRequest())
        minutes(4)
        focusService.endInterruption(session.id, s.interruptions[1].id, InterruptionEndRequest(InterruptionType.STUDY_MATERIAL))
        minutes(2)
        s = focusService.startInterruption(session.id, InterruptionStartRequest())
        minutes(2)
        focusService.endInterruption(session.id, s.interruptions[2].id, InterruptionEndRequest(InterruptionType.BREAK))
        minutes(6)

        // 경과 27분 − 딴짓 3분 − 휴식 2분 = 22분
        val ended = focusService.end(session.id, FocusResult.MORE)
        assertEquals(22 * 60L, ended.focusSeconds)
        assertEquals(5 * 60L, ended.pausedSeconds)
        assertFalse(ended.running)
    }

    @Test
    fun `열린 중단은 종류를 모르니 집중 시간에서 뺀다`() {
        val session = startResume()
        minutes(10)
        focusService.startInterruption(session.id, InterruptionStartRequest(InterruptionDetection.BUTTON))
        minutes(4)
        assertEquals(10 * 60L, focusService.current()!!.focusSeconds)
    }

    @Test
    fun `탭 이탈은 벗어난 시각과 돌아온 시각으로 기록한다`() {
        val session = startResume()
        val hiddenAt = session.startedAt.plusMinutes(5)
        minutes(10)
        val s = focusService.startInterruption(
            session.id,
            InterruptionStartRequest(InterruptionDetection.TAB_HIDDEN, startedAt = hiddenAt),
        )
        val ended = focusService.endInterruption(
            session.id,
            s.interruptions[0].id,
            InterruptionEndRequest(InterruptionType.DISTRACTION, memo = "유튜브", endedAt = hiddenAt.plusMinutes(2)),
        )
        assertEquals(8 * 60L, ended.focusSeconds)
        assertEquals("유튜브", ended.interruptions[0].memo)
        assertEquals(InterruptionDetection.TAB_HIDDEN, ended.interruptions[0].detection)

        // 세션 시작 전이나 앞 중단과 겹치는 시각으로는 시작할 수 없다
        listOf(session.startedAt.minusMinutes(1), hiddenAt.plusMinutes(1)).forEach {
            val e = assertThrows<BusinessRuleException> {
                focusService.startInterruption(session.id, InterruptionStartRequest(InterruptionDetection.TAB_HIDDEN, it))
            }
            assertEquals("INVALID_INTERRUPTION_TIME", e.code)
        }
    }

    @Test
    fun `한 세션에 열린 중단은 하나이고 열린 채로는 세션을 끝낼 수 없다`() {
        val session = startResume()
        focusService.startInterruption(session.id, InterruptionStartRequest())
        val again = assertThrows<BusinessRuleException> {
            focusService.startInterruption(session.id, InterruptionStartRequest())
        }
        assertEquals("INTERRUPTION_OPEN", again.code)
        val end = assertThrows<BusinessRuleException> { focusService.end(session.id, FocusResult.MORE) }
        assertEquals("INTERRUPTION_OPEN", end.code)
    }

    @Test
    fun `완료로 끝내면 하루 목표도 완료되고 끝난 세션은 다시 끝낼 수 없다`() {
        val session = startResume()
        minutes(25)
        val ended = focusService.end(session.id, FocusResult.COMPLETED)
        assertTrue(ended.completed)
        assertEquals(DailyGoalStatus.DONE, ended.dailyGoal?.status)

        val e = assertThrows<BusinessRuleException> { focusService.end(session.id, FocusResult.MORE) }
        assertEquals("SESSION_ENDED", e.code)
    }

    @Test
    fun `분류를 바꾸고 날짜별로 조회한다`() {
        val session = startResume()
        val changed = focusService.changeCategory(session.id, csCategoryId)
        assertEquals(csCategoryId, changed.category?.id)
        focusService.end(session.id, FocusResult.MORE)

        assertEquals(listOf(session.id), focusService.listByDate(thursday).map { it.id })
        assertEquals(0, focusService.listByDate(thursday.plusDays(1)).size)
    }

    @Test
    fun `딴생각 메모를 남기고 확인하면 미확인 목록에서 빠진다`() {
        val session = startResume()
        val note = noteService.add(session.id, " 은행 가기 ")
        noteService.add(session.id, "택배 확인")
        assertEquals("은행 가기", note.content)
        assertEquals(2, focusService.get(session.id).notes.size)
        assertEquals(2, noteService.list(checked = false).size)

        noteService.check(note.id, true)
        assertEquals(listOf("택배 확인"), noteService.list(checked = false).map { it.content })
    }

    @Test
    fun `하루 목표를 지워도 집중 기록은 남는다`() {
        val session = startResume()
        minutes(10)
        focusService.end(session.id, FocusResult.MORE)
        dailyGoalService.delete(resume.id)

        assertEquals(1, focusService.listByDate(thursday).size)
    }
}
