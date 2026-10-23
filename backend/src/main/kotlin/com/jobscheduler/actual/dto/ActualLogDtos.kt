package com.jobscheduler.actual.dto

import com.jobscheduler.actual.ActualKind
import com.jobscheduler.actual.ActualLog
import com.jobscheduler.goal.dto.CategoryRef
import jakarta.validation.constraints.Size
import java.time.LocalDate
import java.time.OffsetDateTime

data class ActualLogRequest(
    val date: LocalDate,
    val startAt: OffsetDateTime,
    val endAt: OffsetDateTime,
    val kind: ActualKind,
    /** GOAL일 때 필수(그날의 하루 목표) */
    val dailyGoalId: Long? = null,
    /** STUDY일 때 필수 */
    val categoryId: Long? = null,
    /** DISTRACTION은 선택, OTHER는 필수 */
    @field:Size(max = 100, message = "제목은 100자 이하로 입력해주세요.")
    val title: String? = null,
)

data class ActualLogResponse(
    val id: Long,
    val date: LocalDate,
    val startAt: OffsetDateTime,
    val endAt: OffsetDateTime,
    val kind: ActualKind,
    val dailyGoalId: Long?,
    val category: CategoryRef?,
    val title: String?,
    /** 화면에 보여줄 이름 */
    val label: String,
    val timeBlockId: Long?,
) {
    companion object {
        fun from(a: ActualLog) = ActualLogResponse(
            id = a.id!!,
            date = a.date,
            startAt = a.startAt,
            endAt = a.endAt,
            kind = a.kind,
            dailyGoalId = a.dailyGoal?.id,
            category = a.category?.let(CategoryRef::from),
            title = a.title,
            label = a.label,
            timeBlockId = a.timeBlockId,
        )
    }
}
