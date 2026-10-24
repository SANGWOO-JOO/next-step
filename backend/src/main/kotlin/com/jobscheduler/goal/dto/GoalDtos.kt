package com.jobscheduler.goal.dto

import com.jobscheduler.category.Category
import com.jobscheduler.goal.Goal
import com.jobscheduler.goal.GoalStatus
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import java.time.LocalDate

// ---- 요청 ----

data class GoalRequest(
    @field:NotBlank(message = "목표 이름을 입력해주세요.")
    @field:Size(max = 200, message = "목표 이름은 200자 이하로 입력해주세요.")
    val title: String,
    val categoryId: Long,
    /** 비우면 기한 없음 */
    val targetDate: LocalDate? = null,
)

data class GoalStatusRequest(val status: GoalStatus)

data class GoalWeekRequest(
    @field:Min(value = 0, message = "목표 시간은 0분 이상이어야 해요.")
    @field:Max(value = 7 * 24 * 60, message = "목표 시간은 한 주를 넘을 수 없어요.")
    val minutes: Int,
)

// ---- 응답 ----

data class CategoryRef(val id: Long, val name: String, val color: String, val active: Boolean, val icon: String? = null) {
    companion object {
        fun from(c: Category) = CategoryRef(c.id!!, c.name, c.color, c.active, c.icon)
    }
}

data class GoalResponse(
    val id: Long,
    val title: String,
    val category: CategoryRef,
    val targetDate: LocalDate?,
    val status: GoalStatus,
) {
    companion object {
        fun from(g: Goal) = GoalResponse(g.id!!, g.title, CategoryRef.from(g.category), g.targetDate, g.status)
    }
}

/** 계획 화면의 목표 한 줄: 이번 주 목표 시간, 일정에 잡은 시간, 실제로 한 시간(분) */
data class GoalWeekRow(
    val goal: GoalResponse,
    val targetMinutes: Int,
    val scheduledMinutes: Int,
    val actualMinutes: Int,
)

data class WeekPlanResponse(
    val weekStart: LocalDate,
    val goals: List<GoalWeekRow>,
    val targetMinutes: Int,
    val scheduledMinutes: Int,
    val actualMinutes: Int,
)
