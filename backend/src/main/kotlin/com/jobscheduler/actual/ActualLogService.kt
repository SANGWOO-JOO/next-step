package com.jobscheduler.actual

import com.jobscheduler.JobSchedulerApplication
import com.jobscheduler.actual.dto.ActualLogRequest
import com.jobscheduler.actual.dto.ActualLogResponse
import com.jobscheduler.category.CategoryService
import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.common.NotFoundException
import com.jobscheduler.daily.DailyGoalRepository
import com.jobscheduler.timeblock.TimeBlockRepository
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.temporal.ChronoUnit

/**
 * 실제 기록(docs/design.md 1-4e). 같은 날 기록끼리 겹치지 않게 새 기록이 겹친 기존 기록을 자르거나 나누고,
 * 같은 내용이 바로 붙으면 하나로 합친다. 쓰고 나면 그날 기록 전체를 돌려준다.
 */
@Service
@Transactional
class ActualLogService(
    private val actualLogRepository: ActualLogRepository,
    private val dailyGoalRepository: DailyGoalRepository,
    private val timeBlockRepository: TimeBlockRepository,
    private val categoryService: CategoryService,
) {
    companion object {
        private val ZONE: ZoneId = ZoneId.of(JobSchedulerApplication.APP_ZONE)
        const val MAX_RANGE_DAYS = 62L
        /** 시각은 5분 단위(화면 눈금은 15분, 직접 입력은 5분) */
        const val GRID_MINUTES = 5
    }

    @Transactional(readOnly = true)
    fun list(from: LocalDate, to: LocalDate): List<ActualLogResponse> {
        if (to.isBefore(from) || ChronoUnit.DAYS.between(from, to) > MAX_RANGE_DAYS) {
            throw BusinessRuleException("조회 기간은 $MAX_RANGE_DAYS 일 이내여야 해요.", "INVALID_RANGE")
        }
        return actualLogRepository.findAllByDateBetween(from, to)
            .sortedWith(compareBy({ it.startAt }, { it.id }))
            .map(ActualLogResponse::from)
    }

    fun create(req: ActualLogRequest): List<ActualLogResponse> {
        val log = ActualLog(req.date, req.startAt, req.endAt, req.kind)
        fill(log, req)
        return place(log)
    }

    fun update(id: Long, req: ActualLogRequest): List<ActualLogResponse> {
        val log = getEntity(id)
        log.date = req.date
        log.startAt = req.startAt
        log.endAt = req.endAt
        log.kind = req.kind
        fill(log, req)
        return place(log)
    }

    fun delete(id: Long) {
        actualLogRepository.delete(getEntity(id))
    }

    /** [계획대로]: 계획 블록의 시간과 내용을 그대로 실제 기록으로 */
    fun fromBlock(blockId: Long): List<ActualLogResponse> {
        val block = timeBlockRepository.findByIdOrNull(blockId) ?: throw NotFoundException("시간 블록을 찾을 수 없어요: $blockId")
        val goal = block.dailyGoal
        val log = ActualLog(
            date = block.date,
            startAt = block.startAt,
            endAt = block.endAt,
            kind = if (goal != null) ActualKind.GOAL else ActualKind.OTHER,
            dailyGoal = goal,
            category = goal?.category,
            title = if (goal == null) block.title else null,
            timeBlockId = block.id,
        )
        return place(log)
    }

    /** 전에 쓴 딴짓 제목(최근 순, 겹치지 않게, 최대 10개). prefix로 거른다 */
    @Transactional(readOnly = true)
    fun distractionTitles(prefix: String?): List<String> =
        actualLogRepository.findAllByKindOrderByStartAtDesc(ActualKind.DISTRACTION)
            .mapNotNull { it.title }
            .filter { prefix.isNullOrBlank() || it.startsWith(prefix.trim(), ignoreCase = true) }
            .distinct()
            .take(10)

    /** 종류에 맞게 연결과 제목을 채운다 */
    private fun fill(log: ActualLog, req: ActualLogRequest) {
        val title = req.title?.trim()?.ifEmpty { null }
        when (req.kind) {
            ActualKind.GOAL -> {
                val goalId = req.dailyGoalId ?: throw BusinessRuleException("하루 목표를 골라주세요.", "GOAL_REQUIRED")
                val goal = dailyGoalRepository.findByIdOrNull(goalId) ?: throw NotFoundException("하루 목표를 찾을 수 없어요: $goalId")
                if (goal.date != req.date) throw BusinessRuleException("그날의 하루 목표만 고를 수 있어요.", "GOAL_DATE_MISMATCH")
                log.dailyGoal = goal
                log.category = goal.category
                log.title = null
            }
            ActualKind.STUDY -> {
                val categoryId = req.categoryId ?: throw BusinessRuleException("공부한 분류를 골라주세요.", "CATEGORY_REQUIRED")
                log.dailyGoal = null
                log.category = if (categoryId == log.category?.id) log.category else categoryService.getAssignable(categoryId)
                log.title = title
            }
            ActualKind.DISTRACTION -> {
                log.dailyGoal = null
                log.category = null
                log.title = title
            }
            ActualKind.OTHER -> {
                log.dailyGoal = null
                log.category = null
                log.title = title ?: throw BusinessRuleException("무엇을 했는지 적어주세요.", "TITLE_REQUIRED")
            }
        }
    }

    /** 검증 후 겹친 기존 기록을 자르고 붙은 같은 기록을 합친다 */
    private fun place(log: ActualLog): List<ActualLogResponse> {
        validate(log)
        val others = actualLogRepository.findAllByDate(log.date).filter { it.id == null || it.id != log.id }
        for (e in others) {
            if (!e.startAt.isBefore(log.endAt) || !e.endAt.isAfter(log.startAt)) continue
            when {
                e.startAt.isBefore(log.startAt) && e.endAt.isAfter(log.endAt) -> {
                    // 새 기록이 가운데 들어오면 기존 기록을 둘로 나눈다
                    actualLogRepository.save(e.copy(log.endAt, e.endAt))
                    e.endAt = log.startAt
                }
                e.startAt.isBefore(log.startAt) -> e.endAt = log.startAt
                e.endAt.isAfter(log.endAt) -> e.startAt = log.endAt
                else -> actualLogRepository.delete(e)
            }
        }
        actualLogRepository.save(log)
        actualLogRepository.flush()
        merge(log.date)
        return actualLogRepository.findAllByDate(log.date)
            .sortedWith(compareBy({ it.startAt }, { it.id }))
            .map(ActualLogResponse::from)
    }

    /** 바로 붙어 있는 같은 내용 기록을 하나로 */
    private fun merge(date: LocalDate) {
        val logs = actualLogRepository.findAllByDate(date).sortedBy { it.startAt }
        var prev: ActualLog? = null
        for (cur in logs) {
            val p = prev
            if (p != null && p.endAt.isEqual(cur.startAt) && p.sameContent(cur)) {
                p.endAt = cur.endAt
                if (p.timeBlockId == null) p.timeBlockId = cur.timeBlockId
                actualLogRepository.delete(cur)
            } else {
                prev = cur
            }
        }
        actualLogRepository.flush()
    }

    private fun validate(log: ActualLog) {
        if (!log.endAt.isAfter(log.startAt)) {
            throw BusinessRuleException("종료 시각은 시작 시각보다 늦어야 해요.", "INVALID_PERIOD")
        }
        val dayStart = log.date.atStartOfDay(ZONE).toOffsetDateTime()
        if (log.startAt.isBefore(dayStart) || log.endAt.isAfter(dayStart.plusDays(1))) {
            throw BusinessRuleException("실제 기록은 그 날짜(${log.date}) 안에서만 적을 수 있어요.", "LOG_OUT_OF_DAY")
        }
        fun onGrid(t: OffsetDateTime) = t.atZoneSameInstant(ZONE).let { it.minute % GRID_MINUTES == 0 && it.second == 0 }
        if (!onGrid(log.startAt) || !onGrid(log.endAt)) {
            throw BusinessRuleException("시각은 ${GRID_MINUTES}분 단위로 적어주세요.", "OFF_GRID")
        }
    }

    private fun getEntity(id: Long): ActualLog =
        actualLogRepository.findByIdOrNull(id) ?: throw NotFoundException("실제 기록을 찾을 수 없어요: $id")
}
