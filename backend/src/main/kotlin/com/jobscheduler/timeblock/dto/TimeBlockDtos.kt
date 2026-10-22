package com.jobscheduler.timeblock.dto

import com.jobscheduler.daily.DailyGoalStatus
import com.jobscheduler.daily.DailyGoalType
import com.jobscheduler.goal.dto.CategoryRef
import com.jobscheduler.timeblock.TimeBlock
import java.time.LocalDate
import java.time.OffsetDateTime

data class TimeBlockRequest(
    val dailyGoalId: Long,
    val startAt: OffsetDateTime,
    val endAt: OffsetDateTime,
)

data class TimeBlockResponse(
    val id: Long,
    val dailyGoalId: Long,
    val dailyGoalContent: String,
    val dailyGoalType: DailyGoalType,
    val dailyGoalStatus: DailyGoalStatus,
    val category: CategoryRef?,
    val date: LocalDate,
    val startAt: OffsetDateTime,
    val endAt: OffsetDateTime,
) {
    companion object {
        fun from(b: TimeBlock) = TimeBlockResponse(
            id = b.id!!,
            dailyGoalId = b.dailyGoal.id!!,
            dailyGoalContent = b.dailyGoal.content,
            dailyGoalType = b.dailyGoal.type,
            dailyGoalStatus = b.dailyGoal.status,
            category = b.dailyGoal.category?.let(CategoryRef::from),
            date = b.date,
            startAt = b.startAt,
            endAt = b.endAt,
        )
    }
}
