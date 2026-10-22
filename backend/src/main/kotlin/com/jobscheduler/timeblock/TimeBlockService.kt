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
        val dailyGoal = getDailyGoal(req.dailyGoalId)
        validate(dailyGoal, req.startAt, req.endAt, excludeId = null)
        val block = timeBlockRepository.save(
            TimeBlock(dailyGoal = dailyGoal, date = dailyGoal.date, startAt = req.startAt, endAt = req.endAt),
        )
        return TimeBlockResponse.from(block)
    }

    fun update(id: Long, req: TimeBlockRequest): TimeBlockResponse {
        val block = getEntity(id)
        val dailyGoal = if (req.dailyGoalId == block.dailyGoal.id) block.dailyGoal else getDailyGoal(req.dailyGoalId)
        validate(dailyGoal, req.startAt, req.endAt, excludeId = id)
        block.dailyGoal = dailyGoal
        block.date = dailyGoal.date
        block.startAt = req.startAt
        block.endAt = req.endAt
        return TimeBlockResponse.from(block)
    }

    fun delete(id: Long) {
        timeBlockRepository.delete(getEntity(id))
    }

    /**
     * 블록은 하루 목표의 날짜 안(00:00 ~ 다음 날 00:00)에 있어야 하고, 같은 날 다른 블록과 겹치면 안 된다.
     */
    private fun validate(dailyGoal: DailyGoal, startAt: OffsetDateTime, endAt: OffsetDateTime, excludeId: Long?) {
        if (!endAt.isAfter(startAt)) {
            throw BusinessRuleException("종료 시각은 시작 시각보다 늦어야 해요.", "INVALID_PERIOD")
        }
        val dayStart = dailyGoal.date.atStartOfDay(ZONE).toOffsetDateTime()
        val dayEnd = dayStart.plusDays(1)
        if (startAt.isBefore(dayStart) || endAt.isAfter(dayEnd)) {
            throw BusinessRuleException(
                "시간 블록은 하루 목표의 날짜(${dailyGoal.date}) 안에서만 잡을 수 있어요.",
                "BLOCK_OUT_OF_DAY",
            )
        }
        val overlapped = timeBlockRepository.findAllByDate(dailyGoal.date)
            .firstOrNull { it.id != excludeId && it.startAt.isBefore(endAt) && it.endAt.isAfter(startAt) }
        if (overlapped != null) {
            val time = { t: OffsetDateTime -> t.atZoneSameInstant(ZONE).toLocalTime().toString() }
            throw BusinessRuleException(
                "${time(overlapped.startAt)}~${time(overlapped.endAt)} '${overlapped.dailyGoal.content}' 블록과 겹쳐요.",
                "BLOCK_OVERLAP",
            )
        }
    }

    private fun getDailyGoal(id: Long): DailyGoal =
        dailyGoalRepository.findByIdOrNull(id) ?: throw NotFoundException("하루 목표를 찾을 수 없어요: $id")

    private fun getEntity(id: Long): TimeBlock =
        timeBlockRepository.findByIdOrNull(id) ?: throw NotFoundException("시간 블록을 찾을 수 없어요: $id")
}
