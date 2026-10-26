package com.jobscheduler.ai

import com.jobscheduler.JobSchedulerApplication
import com.jobscheduler.review.dto.AiFeedbackBlock
import com.jobscheduler.review.dto.AiFeedbackState
import org.springframework.stereotype.Component
import java.time.Clock
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId

/**
 * 주간 피드백을 받을 수 있는지(docs/design.md 9-1, 2026-10-26 변경):
 * 키, 시작한 주, 일지를 쓴 뒤, 기록 1시간 이상, 하루 1회, 주 3회까지. 진행 중인 주도 된다.
 */
@Component
class AiFeedbackPolicy(private val feedbackClient: FeedbackClient, private val clock: Clock) {
    companion object {
        const val MAX_COUNT = 3
        const val MIN_STUDY_SECONDS = 60 * 60L
        private val ZONE: ZoneId = ZoneId.of(JobSchedulerApplication.APP_ZONE)
    }

    fun today(): LocalDate = LocalDate.now(clock.withZone(ZONE))

    /** 그 주가 아직 진행 중인지(오늘이 그 주 안) */
    fun inProgress(weekStart: LocalDate) = today().isBefore(weekStart.plusDays(7))

    fun state(weekStart: LocalDate, count: Int, lastAt: OffsetDateTime?, journalWritten: Boolean, studySeconds: Long): AiFeedbackState {
        val today = today()
        val blocked = when {
            !feedbackClient.available -> AiFeedbackBlock.UNAVAILABLE
            today.isBefore(weekStart) -> AiFeedbackBlock.NOT_STARTED
            count >= MAX_COUNT -> AiFeedbackBlock.LIMIT
            lastAt != null && lastAt.atZoneSameInstant(ZONE).toLocalDate() == today -> AiFeedbackBlock.TODAY_DONE
            !journalWritten -> AiFeedbackBlock.NO_JOURNAL
            studySeconds < MIN_STUDY_SECONDS -> AiFeedbackBlock.TOO_LITTLE
            else -> null
        }
        return AiFeedbackState(count, MAX_COUNT, blocked)
    }
}
