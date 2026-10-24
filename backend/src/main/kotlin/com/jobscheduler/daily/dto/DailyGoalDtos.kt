package com.jobscheduler.daily.dto

import com.jobscheduler.daily.DailyGoal
import com.jobscheduler.daily.DailyGoalStatus
import com.jobscheduler.daily.DailyGoalType
import com.jobscheduler.goal.dto.CategoryRef
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.Size
import java.time.LocalDate

data class DailyGoalCreateRequest(
    /** 비우면 목표에 묶지 않는다 */
    val goalId: Long? = null,
    val date: LocalDate,
    @field:NotBlank(message = "내용을 입력해주세요.")
    @field:Size(max = 500, message = "내용은 500자 이하로 입력해주세요.")
    val content: String,
    @field:Size(max = 500, message = "첫 행동은 500자 이하로 입력해주세요.")
    val firstAction: String? = null,
    /** 비우면 묶은 목표의 분류를 물려받는다. */
    val categoryId: Long? = null,
    /** 비우면 핵심 자리가 남아 있을 때 CORE, 아니면 EXTRA */
    val type: DailyGoalType? = null,
)

data class DailyGoalUpdateRequest(
    @field:NotBlank(message = "내용을 입력해주세요.")
    @field:Size(max = 500, message = "내용은 500자 이하로 입력해주세요.")
    val content: String,
    @field:Size(max = 500, message = "첫 행동은 500자 이하로 입력해주세요.")
    val firstAction: String? = null,
    val categoryId: Long? = null,
    val status: DailyGoalStatus = DailyGoalStatus.TODO,
)

data class DailyGoalMoveRequest(
    val date: LocalDate,
)

data class DailyGoalTypeRequest(val type: DailyGoalType)

/** 목표에 묶기·풀기. null이면 푼다 */
data class DailyGoalLinkRequest(val goalId: Long?)

data class DailyGoalOrderRequest(
    val date: LocalDate,
    val type: DailyGoalType,
    @field:NotEmpty(message = "순서를 입력해주세요.")
    val ids: List<Long>,
)

data class DailyGoalResponse(
    val id: Long,
    val goalId: Long?,
    val goalTitle: String?,
    val date: LocalDate,
    val content: String,
    val firstAction: String?,
    val category: CategoryRef?,
    val type: DailyGoalType,
    val sortOrder: Int,
    val status: DailyGoalStatus,
    val carryCount: Int,
) {
    companion object {
        fun from(d: DailyGoal) = DailyGoalResponse(
            id = d.id!!,
            goalId = d.goal?.id,
            goalTitle = d.goal?.title,
            date = d.date,
            content = d.content,
            firstAction = d.firstAction,
            category = d.category?.let(CategoryRef::from),
            type = d.type,
            sortOrder = d.sortOrder,
            status = d.status,
            carryCount = d.carryCount,
        )
    }
}

data class DailyGoalMoveResponse(
    val dailyGoal: DailyGoalResponse,
    /** 넘길 날에 핵심이 이미 3개여서 추가(EXTRA)로 바뀌었는지 */
    val downgradedToExtra: Boolean,
    /** 원래 날에 잡혀 있다가 지워진 시간 블록 수 */
    val removedTimeBlocks: Int = 0,
)
