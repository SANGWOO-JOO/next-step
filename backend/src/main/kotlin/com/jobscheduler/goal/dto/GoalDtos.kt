package com.jobscheduler.goal.dto

import com.jobscheduler.category.Category
import com.jobscheduler.goal.Goal
import com.jobscheduler.goal.GoalStatus
import com.jobscheduler.goal.MonthlyGoal
import com.jobscheduler.goal.WeeklyGoal
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import java.math.BigDecimal
import java.time.LocalDate
import java.time.YearMonth

// ---- 요청 ----

data class GoalRequest(
    @field:NotBlank(message = "제목을 입력해주세요.")
    @field:Size(max = 200, message = "제목은 200자 이하로 입력해주세요.")
    val title: String,
    @field:Size(max = 2000, message = "설명은 2000자 이하로 입력해주세요.")
    val description: String? = null,
    val startDate: LocalDate,
    val targetDate: LocalDate,
    val status: GoalStatus = GoalStatus.ACTIVE,
)

data class MonthlyGoalCreateRequest(
    val goalId: Long,
    val month: YearMonth,
    @field:NotBlank(message = "내용을 입력해주세요.")
    @field:Size(max = 500, message = "내용은 500자 이하로 입력해주세요.")
    val content: String,
    val targetValue: BigDecimal? = null,
    val currentValue: BigDecimal? = null,
    @field:Size(max = 20, message = "단위는 20자 이하로 입력해주세요.")
    val unit: String? = null,
)

data class MonthlyGoalUpdateRequest(
    val month: YearMonth,
    @field:NotBlank(message = "내용을 입력해주세요.")
    @field:Size(max = 500, message = "내용은 500자 이하로 입력해주세요.")
    val content: String,
    val targetValue: BigDecimal? = null,
    val currentValue: BigDecimal? = null,
    @field:Size(max = 20, message = "단위는 20자 이하로 입력해주세요.")
    val unit: String? = null,
    val achieved: Boolean = false,
)

/** 다음 주가 다른 달이면 그 달의 월간 목표가 필요하다 */
data class WeeklyGoalCarryRequest(val monthlyGoalId: Long? = null)

data class WeeklyGoalCreateRequest(
    val monthlyGoalId: Long,
    val weekStart: LocalDate,
    @field:NotBlank(message = "내용을 입력해주세요.")
    @field:Size(max = 500, message = "내용은 500자 이하로 입력해주세요.")
    val content: String,
    val categoryId: Long? = null,
)

data class WeeklyGoalUpdateRequest(
    val weekStart: LocalDate,
    @field:NotBlank(message = "내용을 입력해주세요.")
    @field:Size(max = 500, message = "내용은 500자 이하로 입력해주세요.")
    val content: String,
    val categoryId: Long? = null,
    val achieved: Boolean = false,
)

// ---- 응답 ----

/** 하위 목표 달성 비율. 하위 목표가 없으면 0% */
data class Progress(val achieved: Int, val total: Int, val percent: Int) {
    companion object {
        fun of(flags: List<Boolean>): Progress {
            val achieved = flags.count { it }
            val percent = if (flags.isEmpty()) 0 else achieved * 100 / flags.size
            return Progress(achieved, flags.size, percent)
        }
    }
}

data class CategoryRef(val id: Long, val name: String, val color: String, val active: Boolean, val icon: String? = null) {
    companion object {
        fun from(c: Category) = CategoryRef(c.id!!, c.name, c.color, c.active, c.icon)
    }
}

data class WeeklyGoalResponse(
    val id: Long,
    val monthlyGoalId: Long,
    val weekStart: LocalDate,
    val content: String,
    val category: CategoryRef?,
    val achieved: Boolean,
    val carriedOver: Boolean,
) {
    companion object {
        fun from(w: WeeklyGoal) = WeeklyGoalResponse(
            id = w.id!!,
            monthlyGoalId = w.monthlyGoal.id!!,
            weekStart = w.weekStart,
            content = w.content,
            category = w.category?.let(CategoryRef::from),
            achieved = w.achieved,
            carriedOver = w.carriedOver,
        )
    }
}

data class MonthlyGoalResponse(
    val id: Long,
    val goalId: Long,
    val month: YearMonth,
    val content: String,
    val targetValue: BigDecimal?,
    val currentValue: BigDecimal?,
    val unit: String?,
    val achieved: Boolean,
    val progress: Progress,
    val weeklyGoals: List<WeeklyGoalResponse>,
) {
    companion object {
        fun from(m: MonthlyGoal, weeklyGoals: List<WeeklyGoal>) = MonthlyGoalResponse(
            id = m.id!!,
            goalId = m.goal.id!!,
            month = m.month,
            content = m.content,
            targetValue = m.targetValue,
            currentValue = m.currentValue,
            unit = m.unit,
            achieved = m.achieved,
            progress = Progress.of(weeklyGoals.map { it.achieved }),
            weeklyGoals = weeklyGoals.map(WeeklyGoalResponse::from),
        )
    }
}

data class GoalResponse(
    val id: Long,
    val title: String,
    val description: String?,
    val startDate: LocalDate,
    val targetDate: LocalDate,
    val status: GoalStatus,
    val progress: Progress,
    val monthlyGoals: List<MonthlyGoalResponse>,
) {
    companion object {
        fun from(g: Goal, monthlyGoals: List<MonthlyGoalResponse>) = GoalResponse(
            id = g.id!!,
            title = g.title,
            description = g.description,
            startDate = g.startDate,
            targetDate = g.targetDate,
            status = g.status,
            progress = Progress.of(monthlyGoals.map { it.achieved }),
            monthlyGoals = monthlyGoals,
        )
    }
}
