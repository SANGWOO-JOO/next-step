package com.jobscheduler.record

import com.jobscheduler.daily.DailyGoalRepository
import com.jobscheduler.daily.DailyGoalStatus
import com.jobscheduler.focus.FocusSessionRepository
import com.jobscheduler.focus.FocusTime
import com.jobscheduler.focus.InterruptionType
import com.jobscheduler.record.dto.DailyLogRequest
import com.jobscheduler.record.dto.DailyLogResponse
import com.jobscheduler.record.dto.DailySummary
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Duration
import java.time.LocalDate
import java.time.OffsetDateTime

@Service
@Transactional
class DailyLogService(
    private val dailyLogRepository: DailyLogRepository,
    private val manualLogRepository: ManualStudyLogRepository,
    private val focusSessionRepository: FocusSessionRepository,
    private val dailyGoalRepository: DailyGoalRepository,
    private val clock: Clock,
) {
    /** 저장한 기록이 없어도 자동 집계는 돌려준다. */
    @Transactional(readOnly = true)
    fun get(date: LocalDate): DailyLogResponse = toResponse(date, dailyLogRepository.findByDate(date))

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
        )
    }

    private fun toResponse(date: LocalDate, log: DailyLog?) = DailyLogResponse(
        date = date,
        saved = log != null,
        memo = log?.memo,
        condition = log?.condition,
        updatedAt = log?.updatedAt,
        summary = summary(date),
    )
}
