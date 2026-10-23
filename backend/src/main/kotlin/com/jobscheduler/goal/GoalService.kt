package com.jobscheduler.goal

import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.common.NotFoundException
import com.jobscheduler.goal.dto.GoalRequest
import com.jobscheduler.goal.dto.GoalResponse
import com.jobscheduler.goal.dto.MonthlyGoalResponse
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional
class GoalService(
    private val goalRepository: GoalRepository,
    private val monthlyGoalRepository: MonthlyGoalRepository,
    private val weeklyGoalRepository: WeeklyGoalRepository,
) {

    @Transactional(readOnly = true)
    fun list(): List<GoalResponse> = toResponses(goalRepository.findAllByOrderByStartDateAscIdAsc())

    @Transactional(readOnly = true)
    fun get(id: Long): GoalResponse = toResponses(listOf(getEntity(id))).single()

    fun create(req: GoalRequest): GoalResponse {
        GoalRules.requirePeriod(req.startDate, req.targetDate)
        val goal = goalRepository.save(
            Goal(
                title = req.title.trim(),
                description = req.description?.trim()?.ifEmpty { null },
                startDate = req.startDate,
                targetDate = req.targetDate,
                status = req.status,
            ),
        )
        return GoalResponse.from(goal, emptyList())
    }

    fun update(id: Long, req: GoalRequest): GoalResponse {
        val goal = getEntity(id)
        GoalRules.requirePeriod(req.startDate, req.targetDate)
        // 기간을 줄여도 이미 연결된 월간 목표는 기간 안에 남아 있어야 한다
        monthlyGoalRepository.findAllByGoalIdInOrderByMonthStartAscIdAsc(listOf(id)).forEach {
            GoalRules.requireMonthInPeriod(it.month, req.startDate, req.targetDate)
        }

        goal.title = req.title.trim()
        goal.description = req.description?.trim()?.ifEmpty { null }
        goal.startDate = req.startDate
        goal.targetDate = req.targetDate
        goal.status = req.status
        return get(id)
    }

    /** 주간 목표가 없는 월간 목표는 함께 지운다. 주간 목표가 연결된 월간 목표가 있으면 지울 수 없다. */
    fun delete(id: Long) {
        val goal = getEntity(id)
        val monthlyGoals = monthlyGoalRepository.findAllByGoalIdInOrderByMonthStartAscIdAsc(listOf(id))
        if (monthlyGoals.any { weeklyGoalRepository.existsByMonthlyGoalId(it.id!!) }) {
            throw BusinessRuleException(
                "주간 목표가 연결된 월간 목표가 있어 삭제할 수 없어요. [주] 보기에서 주간 목표를 먼저 지워 주세요.",
                "HAS_CHILDREN",
            )
        }
        monthlyGoalRepository.deleteAll(monthlyGoals)
        goalRepository.delete(goal)
    }

    private fun getEntity(id: Long): Goal =
        goalRepository.findByIdOrNull(id) ?: throw NotFoundException("최종 목표를 찾을 수 없어요: $id")

    private fun toResponses(goals: List<Goal>): List<GoalResponse> {
        val monthlyGoals = monthlyGoalRepository.findAllByGoalIdInOrderByMonthStartAscIdAsc(goals.map { it.id!! })
        val weeklyByMonthly = weeklyGoalRepository
            .findAllByMonthlyGoalIdInOrderByWeekStartAscIdAsc(monthlyGoals.map { it.id!! })
            .groupBy { it.monthlyGoal.id!! }
        val monthlyByGoal = monthlyGoals
            .map { MonthlyGoalResponse.from(it, weeklyByMonthly[it.id].orEmpty()) }
            .groupBy { it.goalId }
        return goals.map { GoalResponse.from(it, monthlyByGoal[it.id].orEmpty()) }
    }
}
