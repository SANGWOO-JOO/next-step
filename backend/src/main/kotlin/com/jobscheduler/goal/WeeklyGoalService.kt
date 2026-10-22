package com.jobscheduler.goal

import com.jobscheduler.category.CategoryService
import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.common.NotFoundException
import com.jobscheduler.goal.dto.WeeklyGoalCreateRequest
import com.jobscheduler.goal.dto.WeeklyGoalResponse
import com.jobscheduler.goal.dto.WeeklyGoalUpdateRequest
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate

@Service
@Transactional
class WeeklyGoalService(
    private val monthlyGoalRepository: MonthlyGoalRepository,
    private val weeklyGoalRepository: WeeklyGoalRepository,
    private val categoryService: CategoryService,
) {

    @Transactional(readOnly = true)
    fun list(monthlyGoalId: Long?, weekStart: LocalDate?): List<WeeklyGoalResponse> {
        val weeklyGoals = when {
            monthlyGoalId != null -> weeklyGoalRepository.findAllByMonthlyGoalIdInOrderByWeekStartAscIdAsc(listOf(monthlyGoalId))
                .filter { weekStart == null || it.weekStart == weekStart }
            weekStart != null -> weeklyGoalRepository.findAllByWeekStartOrderByIdAsc(weekStart)
            else -> throw BusinessRuleException("monthlyGoalId 또는 weekStart 중 하나는 필요해요.", "MISSING_FILTER")
        }
        return weeklyGoals.map(WeeklyGoalResponse::from)
    }

    fun create(req: WeeklyGoalCreateRequest): WeeklyGoalResponse {
        val monthlyGoal = monthlyGoalRepository.findByIdOrNull(req.monthlyGoalId)
            ?: throw NotFoundException("월간 목표를 찾을 수 없어요: ${req.monthlyGoalId}")
        GoalRules.requireWeekInMonth(req.weekStart, monthlyGoal.month)

        val weeklyGoal = weeklyGoalRepository.save(
            WeeklyGoal(
                monthlyGoal = monthlyGoal,
                weekStart = req.weekStart,
                content = req.content.trim(),
                category = req.categoryId?.let(categoryService::getAssignable),
            ),
        )
        return WeeklyGoalResponse.from(weeklyGoal)
    }

    fun update(id: Long, req: WeeklyGoalUpdateRequest): WeeklyGoalResponse {
        val weeklyGoal = getEntity(id)
        GoalRules.requireWeekInMonth(req.weekStart, weeklyGoal.monthlyGoal.month)

        // 이미 지정된 분류는 나중에 비활성화돼도 유지할 수 있고, 새로 지정할 때만 활성 여부를 본다
        if (req.categoryId != weeklyGoal.category?.id) {
            weeklyGoal.category = req.categoryId?.let(categoryService::getAssignable)
        }
        weeklyGoal.weekStart = req.weekStart
        weeklyGoal.content = req.content.trim()
        weeklyGoal.achieved = req.achieved
        return WeeklyGoalResponse.from(weeklyGoal)
    }

    fun delete(id: Long) {
        weeklyGoalRepository.delete(getEntity(id))
    }

    private fun getEntity(id: Long): WeeklyGoal =
        weeklyGoalRepository.findByIdOrNull(id) ?: throw NotFoundException("주간 목표를 찾을 수 없어요: $id")
}
