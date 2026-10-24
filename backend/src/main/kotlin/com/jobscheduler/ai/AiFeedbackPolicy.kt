package com.jobscheduler.ai

import com.jobscheduler.JobSchedulerApplication
import com.jobscheduler.review.dto.AiFeedbackBlock
import com.jobscheduler.review.dto.AiFeedbackState
import org.springframework.stereotype.Component
import java.time.Clock
import java.time.LocalDate
import java.time.ZoneId

/** 주간 피드백을 받을 수 있는지(docs/design.md 9-1): 키, 끝난 주, 기록 2시간 이상, 주 2회까지 */
@Component
class AiFeedbackPolicy(private val feedbackClient: FeedbackClient, private val clock: Clock) {
    companion object {
        const val MAX_COUNT = 2
        const val MIN_STUDY_SECONDS = 2 * 60 * 60L
    }

    fun state(weekStart: LocalDate, count: Int, studySeconds: Long): AiFeedbackState {
        val today = LocalDate.now(clock.withZone(ZoneId.of(JobSchedulerApplication.APP_ZONE)))
        val blocked = when {
            !feedbackClient.available -> AiFeedbackBlock.UNAVAILABLE
            today.isBefore(weekStart.plusDays(7)) -> AiFeedbackBlock.NOT_ENDED
            count >= MAX_COUNT -> AiFeedbackBlock.LIMIT
            studySeconds < MIN_STUDY_SECONDS -> AiFeedbackBlock.TOO_LITTLE
            else -> null
        }
        return AiFeedbackState(count, MAX_COUNT, blocked)
    }
}
