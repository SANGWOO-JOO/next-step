package com.jobscheduler.record

import com.jobscheduler.actual.ActualLogService
import com.jobscheduler.daily.DailyGoalRepository
import com.jobscheduler.daily.DailyGoalStatus
import com.jobscheduler.focus.FocusSessionRepository
import com.jobscheduler.focus.FocusTime
import com.jobscheduler.focus.InterruptionType
import com.jobscheduler.record.dto.DailyLogRequest
import com.jobscheduler.record.dto.DailyLogResponse
import com.jobscheduler.record.dto.DailySummary
import com.jobscheduler.common.BusinessRuleException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Duration
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.temporal.ChronoUnit

@Service
@Transactional
class DailyLogService(
    private val dailyLogRepository: DailyLogRepository,
    private val manualLogRepository: ManualStudyLogRepository,
    private val focusSessionRepository: FocusSessionRepository,
    private val dailyGoalRepository: DailyGoalRepository,
    private val actualLogService: ActualLogService,
    private val clock: Clock,
) {
    companion object {
        const val MAX_RANGE_DAYS = 62L
    }

    /** 저장한 기록이 없어도 자동 집계는 돌려준다. */
    @Transactional(readOnly = true)
    fun get(date: LocalDate): DailyLogResponse = toResponse(date, dailyLogRepository.findByDate(date))

    /**
     * 기록 페이지용: from~to(최대 62일) 중 하루 기록을 썼거나 공부·완료 목표가 있는 날을 최신순으로.
     */
    @Transactional(readOnly = true)
    fun list(from: LocalDate, to: LocalDate): List<DailyLogResponse> {
        if (to.isBefore(from) || ChronoUnit.DAYS.between(from, to) > MAX_RANGE_DAYS) {
            throw BusinessRuleException("조회 기간은 $MAX_RANGE_DAYS 일 이내여야 해요.", "INVALID_RANGE")
        }
        val logs = dailyLogRepository.findAllByDateBetween(from, to).associateBy { it.date }
        return generateSequence(to) { it.minusDays(1) }
            .takeWhile { !it.isBefore(from) }
            .map { toResponse(it, logs[it]) }
            .filter { it.saved || it.summary.focusSeconds > 0 || it.summary.manualMinutes > 0 || it.summary.goalsDone > 0 }
            .toList()
    }

    /** 날짜당 1개라 없으면 만들고 있으면 고친다. */
    fun save(date: LocalDate, req: DailyLogRequest): DailyLogResponse {
        val log = dailyLogRepository.findByDate(date) ?: dailyLogRepository.save(DailyLog(date))
        log.memo = req.memo?.trim()?.ifEmpty { null }
        log.condition = req.condition
        return toResponse(date, log)
    }

    /** 세션은 시작한 날짜로 센다(자정을 넘는 세션 분할은 1-4에서). 딴짓은 끝난 DISTRACTION 중단만 센다. */
    fun summary(date: LocalDate): DailySummary {
        val now = OffsetDateTime.now(clock)
        val sessions = focusSessionRepository.findAllByDateOrderByStartedAtAsc(date)
        val goals = dailyGoalRepository.findAllByDateBetween(date, date)
        return DailySummary(
            focusSeconds = sessions.sumOf { it.focusSeconds ?: FocusTime.calculate(it, now).focusSeconds },
            distractionSeconds = sessions.flatMap { it.interruptions }
                .filter { it.type == InterruptionType.DISTRACTION && it.endedAt != null }
                .sumOf { Duration.between(it.startedAt, it.endedAt).seconds },
            sessionCount = sessions.size,
            manualMinutes = manualLogRepository.findAllByDateOrderByCreatedAtAscIdAsc(date).sumOf { it.minutes },
            goalsDone = goals.count { it.status == DailyGoalStatus.DONE },
            goalsTotal = goals.size,
            plan = actualLogService.compare(date),
        )
    }

    private fun toResponse(date: LocalDate, log: DailyLog?) = DailyLogResponse(
        date = date,
        doneGoals = dailyGoalRepository.findAllByDateBetween(date, date)
            .filter { it.status == DailyGoalStatus.DONE }
            .map { it.content },
        saved = log != null,
        memo = log?.memo,
        condition = log?.condition,
        updatedAt = log?.updatedAt,
        summary = summary(date),
    )
}
