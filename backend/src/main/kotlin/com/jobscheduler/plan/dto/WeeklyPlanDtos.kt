package com.jobscheduler.plan.dto

import com.jobscheduler.goal.dto.CategoryRef
import com.jobscheduler.plan.WeeklyPlan
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import java.time.LocalDate

data class WeeklyPlanCreateRequest(
    val weeklyGoalId: Long,
    val date: LocalDate,
    @field:NotBlank(message = "내용을 입력해주세요.")
    @field:Size(max = 500, message = "내용은 500자 이하로 입력해주세요.")
    val content: String,
)

data class WeeklyPlanUpdateRequest(
    /** 같은 주 안의 다른 요일로 옮길 수 있다 */
    val date: LocalDate,
    @field:NotBlank(message = "내용을 입력해주세요.")
    @field:Size(max = 500, message = "내용은 500자 이하로 입력해주세요.")
    val content: String,
)

data class WeeklyPlanResponse(
    val id: Long,
    val weeklyGoalId: Long,
    val weeklyGoalContent: String,
    val category: CategoryRef?,
    val date: LocalDate,
    val content: String,
    val sortOrder: Int,
) {
    companion object {
        fun from(p: WeeklyPlan) = WeeklyPlanResponse(
            id = p.id!!,
            weeklyGoalId = p.weeklyGoal.id!!,
            weeklyGoalContent = p.weeklyGoal.content,
            category = p.weeklyGoal.category?.let(CategoryRef::from),
            date = p.date,
            content = p.content,
            sortOrder = p.sortOrder,
        )
    }
}
