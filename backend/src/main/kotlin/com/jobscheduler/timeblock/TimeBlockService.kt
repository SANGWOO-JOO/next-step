package com.jobscheduler.timeblock

import com.jobscheduler.JobSchedulerApplication
import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.common.NotFoundException
import com.jobscheduler.daily.DailyGoal
import com.jobscheduler.daily.DailyGoalRepository
import com.jobscheduler.timeblock.dto.TimeBlockRequest
import com.jobscheduler.timeblock.dto.TimeBlockResponse
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.temporal.ChronoUnit

@Service
@Transactional
class TimeBlockService(
    private val timeBlockRepository: TimeBlockRepository,
    private val dailyGoalRepository: DailyGoalRepository,
) {
    companion object {
        private val ZONE: ZoneId = ZoneId.of(JobSchedulerApplication.APP_ZONE)
        const val MAX_RANGE_DAYS = 62L
        const val TOPIC_LIMIT = 8
        private val COLOR = Regex("^#[0-9A-Fa-f]{6}$")
    }

    @Transactional(readOnly = true)
    fun list(from: LocalDate, to: LocalDate): List<TimeBlockResponse> {
        if (to.isBefore(from) || ChronoUnit.DAYS.between(from, to) > MAX_RANGE_DAYS) {
            throw BusinessRuleException("조회 기간은 $MAX_RANGE_DAYS 일 이내여야 해요.", "INVALID_RANGE")
        }
        return timeBlockRepository.findAllByDateBetween(from, to)
            .sortedWith(compareBy({ it.startAt }, { it.id }))
            .map(TimeBlockResponse::from)
    }

    fun create(req: TimeBlockRequest): TimeBlockResponse {
        val target = resolve(req, current = null)
        validate(target.date, req.startAt, req.endAt, excludeId = null)
        val block = timeBlockRepository.save(
            TimeBlock(target.dailyGoal, target.title, target.date, req.startAt, req.endAt),
        )
        return TimeBlockResponse.from(block)
    }

    fun update(id: Long, req: TimeBlockRequest): TimeBlockResponse {
        val block = getEntity(id)
        val target = resolve(req, current = block)
        validate(target.date, req.startAt, req.endAt, excludeId = id)
        block.dailyGoal = target.dailyGoal
        block.title = target.title
        block.date = target.date
        block.startAt = req.startAt
        block.endAt = req.endAt
        return TimeBlockResponse.from(block)
    }

    /** 블록 색만 바꾼다(1-4f ㉘). 분류는 그대로 둔다 */
    fun setColor(id: Long, color: String?): TimeBlockResponse {
        val block = getEntity(id)
        val value = color?.trim()?.ifEmpty { null }
        if (value != null && !COLOR.matches(value)) {
            throw BusinessRuleException("색은 #RRGGBB 형식이어야 해요.", "INVALID_COLOR")
        }
        block.color = value?.uppercase()
        return TimeBlockResponse.from(block)
    }

    private data class Target(val dailyGoal: DailyGoal?, val title: String?, val date: LocalDate)

    /**
     * 하루 목표가 있으면 그 날짜를 쓰고, 제목은 그 시간의 주제(예: CS 공부 → 데이터 통신, 1-4f ㊽)로 둔다.
     * 없으면(밥 먹기 같은 일정) 제목과 날짜를 받는다.
     */
    private fun resolve(req: TimeBlockRequest, current: TimeBlock?): Target {
        val title = req.title?.trim()?.ifEmpty { null }
        if (req.dailyGoalId != null) {
            val goal = current?.dailyGoal?.takeIf { it.id == req.dailyGoalId } ?: getDailyGoal(req.dailyGoalId)
            return Target(goal, title, goal.date)
        }
        title
            ?: throw BusinessRuleException("할 일을 고르거나 제목을 입력해주세요.", "GOAL_OR_TITLE_REQUIRED")
        val date = req.date ?: throw BusinessRuleException("날짜가 필요해요.", "DATE_REQUIRED")
        return Target(null, title, date)
    }

    /** 같은 분류의 할 일 블록에 최근 쓴 주제(겹치지 않게, 최근 순). 주제 입력칸 자동완성용 */
    @Transactional(readOnly = true)
    fun recentTopics(categoryId: Long, limit: Int = TOPIC_LIMIT): List<String> =
        timeBlockRepository.findTop100ByDailyGoal_Category_IdAndTitleIsNotNullOrderByIdDesc(categoryId)
            .mapNotNull { it.title }
            .distinct()
            .take(limit)

    fun delete(id: Long) {
        timeBlockRepository.delete(getEntity(id))
    }

    /**
     * 블록은 그 날짜 안(00:00 ~ 다음 날 00:00)에 있어야 하고, 같은 날 다른 블록과 겹치면 안 된다.
     */
    private fun validate(date: LocalDate, startAt: OffsetDateTime, endAt: OffsetDateTime, excludeId: Long?) {
        if (!endAt.isAfter(startAt)) {
            throw BusinessRuleException("종료 시각은 시작 시각보다 늦어야 해요.", "INVALID_PERIOD")
        }
        val dayStart = date.atStartOfDay(ZONE).toOffsetDateTime()
        val dayEnd = dayStart.plusDays(1)
        if (startAt.isBefore(dayStart) || endAt.isAfter(dayEnd)) {
            throw BusinessRuleException(
                "시간 블록은 그 날짜($date) 안에서만 잡을 수 있어요.",
                "BLOCK_OUT_OF_DAY",
            )
        }
        val overlapped = timeBlockRepository.findAllByDate(date)
            .firstOrNull { it.id != excludeId && it.startAt.isBefore(endAt) && it.endAt.isAfter(startAt) }
        if (overlapped != null) {
            val time = { t: OffsetDateTime -> t.atZoneSameInstant(ZONE).toLocalTime().toString() }
            throw BusinessRuleException(
                "${time(overlapped.startAt)}~${time(overlapped.endAt)} '${overlapped.label}' 블록과 겹쳐요.",
                "BLOCK_OVERLAP",
            )
        }
    }

    private fun getDailyGoal(id: Long): DailyGoal =
        dailyGoalRepository.findByIdOrNull(id) ?: throw NotFoundException("할 일을 찾을 수 없어요: $id")

    private fun getEntity(id: Long): TimeBlock =
        timeBlockRepository.findByIdOrNull(id) ?: throw NotFoundException("시간 블록을 찾을 수 없어요: $id")
}
