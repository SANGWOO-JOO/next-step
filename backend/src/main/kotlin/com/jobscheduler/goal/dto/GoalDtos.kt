package com.jobscheduler.goal.dto

import com.jobscheduler.category.Category
import com.jobscheduler.goal.Goal
import com.jobscheduler.goal.GoalStatus
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Pattern
import jakarta.validation.constraints.Size
import java.time.LocalDate

// ---- 요청 ----

data class GoalRequest(
    @field:NotBlank(message = "목표 이름을 입력해주세요.")
    @field:Size(max = 50, message = "목표 이름은 50자 이하로 입력해주세요.")
    val title: String,
    /** 목표 색. 목표와 1:1인 분류의 색이 된다 */
    @field:Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "색상은 #RRGGBB 형식이어야 해요.")
    val color: String,
    /** 비우면 기한 없음 */
    val targetDate: LocalDate? = null,
)

data class GoalStatusRequest(val status: GoalStatus)

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

/** 계획 화면의 목표 한 줄: 일정에 잡은 시간, 실제로 한 시간(분) */
data class GoalWeekRow(
    val goal: GoalResponse,
    val scheduledMinutes: Int,
    val actualMinutes: Int,
)

data class WeekPlanResponse(
    val weekStart: LocalDate,
    val goals: List<GoalWeekRow>,
    val scheduledMinutes: Int,
    val actualMinutes: Int,
)
