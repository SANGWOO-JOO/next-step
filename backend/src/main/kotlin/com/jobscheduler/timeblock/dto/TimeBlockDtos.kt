package com.jobscheduler.timeblock.dto

import com.jobscheduler.daily.DailyGoalStatus
import com.jobscheduler.daily.DailyGoalType
import com.jobscheduler.goal.dto.CategoryRef
import com.jobscheduler.timeblock.TimeBlock
import jakarta.validation.constraints.Size
import java.time.LocalDate
import java.time.OffsetDateTime

data class TimeBlockRequest(
    /** 비우면 목표가 아닌 일정. 이때 title과 date가 필요하다. 있으면 title은 그 시간의 주제 */
    val dailyGoalId: Long? = null,
    @field:Size(max = 100, message = "제목은 100자 이하로 입력해주세요.")
    val title: String? = null,
    /** 목표 없는 블록의 날짜. 하루 목표가 있으면 그 날짜를 쓴다 */
    val date: LocalDate? = null,
    val startAt: OffsetDateTime,
    val endAt: OffsetDateTime,
)

/** 블록 색 바꾸기. null이면 분류 색으로 되돌린다 */
data class TimeBlockColorRequest(val color: String?)

data class TimeBlockResponse(
    val id: Long,
    val dailyGoalId: Long?,
    val dailyGoalContent: String?,
    val dailyGoalType: DailyGoalType?,
    val dailyGoalStatus: DailyGoalStatus?,
    /** 목표 없는 블록의 제목, 또는 할 일 블록의 주제(1-4f ㊽) */
    val title: String?,
    /** 화면에 보여줄 이름: 하루 목표 내용 또는 제목 */
    val label: String,
    val category: CategoryRef?,
    /** 직접 고른 색(#RRGGBB). 없으면 분류 색을 쓴다 */
    val color: String?,
    val date: LocalDate,
    val startAt: OffsetDateTime,
    val endAt: OffsetDateTime,
) {
    companion object {
        fun from(b: TimeBlock) = TimeBlockResponse(
            id = b.id!!,
            dailyGoalId = b.dailyGoal?.id,
            dailyGoalContent = b.dailyGoal?.content,
            dailyGoalType = b.dailyGoal?.type,
            dailyGoalStatus = b.dailyGoal?.status,
            title = b.title,
            label = b.label,
            category = b.dailyGoal?.category?.let(CategoryRef::from),
            color = b.color,
            date = b.date,
            startAt = b.startAt,
            endAt = b.endAt,
        )
    }
}
