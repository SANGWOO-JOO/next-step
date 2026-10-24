package com.jobscheduler.actual

import com.jobscheduler.actual.dto.ActualLogRequest
import com.jobscheduler.category.CategoryService
import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.daily.DailyGoalService
import com.jobscheduler.daily.dto.DailyGoalCreateRequest
import com.jobscheduler.daily.dto.DailyGoalResponse
import com.jobscheduler.goal.GoalService
import com.jobscheduler.goal.dto.GoalRequest
import com.jobscheduler.timeblock.TimeBlockService
import com.jobscheduler.timeblock.dto.TimeBlockRequest
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
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

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ActualLogServiceTest(
    @Autowired private val service: ActualLogService,
    @Autowired private val timeBlockService: TimeBlockService,
    @Autowired private val dailyGoalService: DailyGoalService,
    @Autowired private val categoryService: CategoryService,
    @Autowired private val goalService: GoalService,
) {
    private val day = LocalDate.of(2026, 10, 22)
    private lateinit var resume: DailyGoalResponse
    private var csId = 0L

    private fun at(h: Int, m: Int = 0) = OffsetDateTime.of(2026, 10, 22, h, m, 0, 0, ZoneOffset.ofHours(9))

    @BeforeEach
    fun setUp() {
        csId = categoryService.list(includeInactive = false).first { it.name == "CS 공부" }.id
        val goal = goalService.create(GoalRequest(title = "이직", categoryId = 1L))
        resume = dailyGoalService.create(DailyGoalCreateRequest(goal.id, day, "이력서 작성"))
    }

    private fun goalLog(h1: Int, m1: Int, h2: Int, m2: Int) =
        service.create(ActualLogRequest(day, at(h1, m1), at(h2, m2), ActualKind.GOAL, dailyGoalId = resume.id))

    private fun distraction(h1: Int, m1: Int, h2: Int, m2: Int, title: String? = "유튜브") =
        service.create(ActualLogRequest(day, at(h1, m1), at(h2, m2), ActualKind.DISTRACTION, title = title))

    private fun spans(list: List<com.jobscheduler.actual.dto.ActualLogResponse>) =
        list.map { "${it.startAt.toLocalTime()}-${it.endAt.toLocalTime()} ${it.label}" }

    @Test
    fun `계획대로를 누르면 블록과 같은 시간과 내용으로 기록된다`() {
        val block = timeBlockService.create(TimeBlockRequest(resume.id, startAt = at(9), endAt = at(11)))
        val logs = service.fromBlock(block.id)
        assertEquals(listOf("09:00-11:00 이력서 작성"), spans(logs))
        assertEquals(block.id, logs[0].timeBlockId)
        assertEquals(ActualKind.GOAL, logs[0].kind)
    }

    @Test
    fun `계획대로는 블록의 주제도 실제 기록에 옮긴다`() {
        val block = timeBlockService.create(TimeBlockRequest(resume.id, title = "경력기술서", startAt = at(9), endAt = at(10)))
        val logs = service.fromBlock(block.id)
        assertEquals("경력기술서", logs[0].title)
        assertEquals("이력서 작성", logs[0].label)
    }

    @Test
    fun `가운데 딴짓을 덧붙이면 기존 기록이 둘로 나뉜다`() {
        goalLog(9, 0, 12, 0)
        val logs = distraction(10, 0, 10, 15)
        assertEquals(
            listOf("09:00-10:00 이력서 작성", "10:00-10:15 유튜브", "10:15-12:00 이력서 작성"),
            spans(logs),
        )
    }

    @Test
    fun `겹치는 쪽은 잘리고 완전히 덮이면 지워진다`() {
        goalLog(9, 0, 10, 0)
        distraction(11, 0, 11, 30)
        val logs = service.create(ActualLogRequest(day, at(9, 30), at(11, 15), ActualKind.STUDY, categoryId = csId))
        assertEquals(listOf("09:00-09:30 이력서 작성", "09:30-11:15 CS 공부", "11:15-11:30 유튜브"), spans(logs))

        val covered = distraction(9, 0, 12, 0, title = null)
        assertEquals(listOf("09:00-12:00 딴짓"), spans(covered))
    }

    @Test
    fun `바로 붙은 같은 내용은 하나로 합친다`() {
        goalLog(9, 0, 10, 0)
        val logs = goalLog(10, 0, 11, 0)
        assertEquals(listOf("09:00-11:00 이력서 작성"), spans(logs))
        // 가운데를 같은 내용으로 덮어도 하나로
        distraction(11, 0, 11, 15)
        assertEquals(listOf("09:00-11:00 이력서 작성", "11:00-11:15 유튜브"), spans(service.list(day, day)))
    }

    @Test
    fun `종류에 맞는 값이 있어야 하고 시각은 5분 단위, 그날 안이어야 한다`() {
        assertEquals("GOAL_REQUIRED", assertThrows<BusinessRuleException> {
            service.create(ActualLogRequest(day, at(9), at(10), ActualKind.GOAL))
        }.code)
        assertEquals("CATEGORY_REQUIRED", assertThrows<BusinessRuleException> {
            service.create(ActualLogRequest(day, at(9), at(10), ActualKind.STUDY))
        }.code)
        assertEquals("TITLE_REQUIRED", assertThrows<BusinessRuleException> {
            service.create(ActualLogRequest(day, at(9), at(10), ActualKind.OTHER, title = " "))
        }.code)
        assertEquals("OFF_GRID", assertThrows<BusinessRuleException> { goalLog(9, 3, 10, 0) }.code)
        assertEquals("LOG_OUT_OF_DAY", assertThrows<BusinessRuleException> {
            service.create(ActualLogRequest(day, at(23), at(23).plusHours(2), ActualKind.DISTRACTION))
        }.code)
    }

    @Test
    fun `딴짓 제목은 최근 순으로 겹치지 않게 자동완성된다`() {
        distraction(9, 0, 9, 15, "유튜브")
        distraction(10, 0, 10, 15, "인스타")
        distraction(11, 0, 11, 15, "유튜브")
        assertEquals(listOf("유튜브", "인스타"), service.distractionTitles(null))
        assertEquals(listOf("인스타"), service.distractionTitles("인"))
    }

    @Test
    fun `하루 목표를 지워도 실제 기록은 이름을 남긴 채 남는다`() {
        goalLog(9, 0, 10, 0)
        dailyGoalService.delete(resume.id)
        val logs = service.list(day, day)
        assertEquals(listOf("09:00-10:00 이력서 작성"), spans(logs))
        // 목표의 분류를 물려받은 할 일이라 공부 기록으로 남는다
        assertEquals(ActualKind.STUDY, logs[0].kind)
    }

    @Test
    fun `계획 대비 실제를 비교하고 기록 없는 지난 블록을 돌려준다`() {
        timeBlockService.create(TimeBlockRequest(resume.id, startAt = at(9), endAt = at(11)))
        val lunch = timeBlockService.create(TimeBlockRequest(null, title = "점심", date = day, startAt = at(12), endAt = at(13)))
        goalLog(9, 0, 10, 0)
        distraction(10, 0, 10, 30)

        val c = service.compare(day)
        assertEquals(180, c.plannedMinutes)
        assertEquals(180, c.plannedSoFarMinutes)
        assertEquals(60, c.asPlannedMinutes)
        assertEquals(33, c.asPlannedPercent)
        assertEquals(60, c.actualStudyMinutes)
        assertEquals(30, c.actualDistractionMinutes)
        assertEquals(listOf(lunch.id), c.unrecordedBlocks.map { it.blockId })
    }
}
