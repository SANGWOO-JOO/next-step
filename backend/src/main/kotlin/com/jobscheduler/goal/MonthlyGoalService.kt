package com.jobscheduler.goal

import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.common.NotFoundException
import com.jobscheduler.goal.dto.MonthlyGoalCreateRequest
import com.jobscheduler.goal.dto.MonthlyGoalResponse
import com.jobscheduler.goal.dto.MonthlyGoalUpdateRequest
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.YearMonth

@Service
@Transactional
class MonthlyGoalService(
    private val goalRepository: GoalRepository,
    private val monthlyGoalRepository: MonthlyGoalRepository,
    private val weeklyGoalRepository: WeeklyGoalRepository,
) {

    @Transactional(readOnly = true)
    fun list(goalId: Long?, month: YearMonth?): List<MonthlyGoalResponse> {
        val monthlyGoals = when {
            goalId != null -> monthlyGoalRepository.findAllByGoalIdInOrderByMonthStartAscIdAsc(listOf(goalId))
                .filter { month == null || it.month == month }
            month != null -> monthlyGoalRepository.findAllByMonthStartOrderByIdAsc(month.atDay(1))
            else -> throw BusinessRuleException("goalId 또는 month 중 하나는 필요해요.", "MISSING_FILTER")
        }
        return toResponses(monthlyGoals)
    }

    fun create(req: MonthlyGoalCreateRequest): MonthlyGoalResponse {
        val goal = goalRepository.findByIdOrNull(req.goalId)
            ?: throw NotFoundException("최종 목표를 찾을 수 없어요: ${req.goalId}")
        GoalRules.requireMonthInPeriod(req.month, goal.startDate, goal.targetDate)

        val monthlyGoal = monthlyGoalRepository.save(
            MonthlyGoal(
                goal = goal,
                monthStart = req.month.atDay(1),
                content = req.content.trim(),
                targetValue = req.targetValue,
                currentValue = req.currentValue,
                unit = req.unit?.trim()?.ifEmpty { null },
            ),
        )
        return MonthlyGoalResponse.from(monthlyGoal, emptyList())
    }

    fun update(id: Long, req: MonthlyGoalUpdateRequest): MonthlyGoalResponse {
        val monthlyGoal = getEntity(id)
        val goal = monthlyGoal.goal
        GoalRules.requireMonthInPeriod(req.month, goal.startDate, goal.targetDate)
        // 달을 바꿔도 연결된 주간 목표는 그 달에 속해야 한다
        weeklyGoalRepository.findAllByMonthlyGoalId(id).forEach {
            GoalRules.requireWeekInMonth(it.weekStart, req.month)
        }

        monthlyGoal.monthStart = req.month.atDay(1)
        monthlyGoal.content = req.content.trim()
        monthlyGoal.targetValue = req.targetValue
        monthlyGoal.currentValue = req.currentValue
        monthlyGoal.unit = req.unit?.trim()?.ifEmpty { null }
        monthlyGoal.achieved = req.achieved
        return toResponses(listOf(monthlyGoal)).single()
    }

    fun delete(id: Long) {
        val monthlyGoal = getEntity(id)
        if (weeklyGoalRepository.existsByMonthlyGoalId(id)) {
            throw BusinessRuleException("주간 목표가 연결된 월간 목표는 삭제할 수 없어요.", "HAS_CHILDREN")
        }
        monthlyGoalRepository.delete(monthlyGoal)
    }

    private fun getEntity(id: Long): MonthlyGoal =
        monthlyGoalRepository.findByIdOrNull(id) ?: throw NotFoundException("월간 목표를 찾을 수 없어요: $id")

    private fun toResponses(monthlyGoals: List<MonthlyGoal>): List<MonthlyGoalResponse> {
        val weeklyByMonthly = weeklyGoalRepository
            .findAllByMonthlyGoalIdInOrderByWeekStartAscIdAsc(monthlyGoals.map { it.id!! })
            .groupBy { it.monthlyGoal.id!! }
        return monthlyGoals.map { MonthlyGoalResponse.from(it, weeklyByMonthly[it.id].orEmpty()) }
    }
}
