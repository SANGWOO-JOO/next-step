package com.jobscheduler.plan

import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.common.NotFoundException
import com.jobscheduler.goal.WeeklyGoal
import com.jobscheduler.goal.WeeklyGoalRepository
import com.jobscheduler.plan.dto.WeeklyPlanCreateRequest
import com.jobscheduler.plan.dto.WeeklyPlanResponse
import com.jobscheduler.plan.dto.WeeklyPlanUpdateRequest
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.time.temporal.ChronoUnit

@Service
@Transactional
class WeeklyPlanService(
    private val weeklyPlanRepository: WeeklyPlanRepository,
    private val weeklyGoalRepository: WeeklyGoalRepository,
) {
    companion object {
        const val MAX_RANGE_DAYS = 62L
    }

    /** 날짜 → 순서 → id 순 */
    @Transactional(readOnly = true)
    fun list(from: LocalDate, to: LocalDate): List<WeeklyPlanResponse> {
        if (to.isBefore(from) || ChronoUnit.DAYS.between(from, to) > MAX_RANGE_DAYS) {
            throw BusinessRuleException("조회 기간은 $MAX_RANGE_DAYS 일 이내여야 해요.", "INVALID_RANGE")
        }
        return weeklyPlanRepository.findAllByDateBetween(from, to)
            .sortedWith(compareBy({ it.date }, { it.sortOrder }, { it.id }))
            .map(WeeklyPlanResponse::from)
    }

    fun create(req: WeeklyPlanCreateRequest): WeeklyPlanResponse {
        val weeklyGoal = weeklyGoalRepository.findByIdOrNull(req.weeklyGoalId)
            ?: throw NotFoundException("주간 목표를 찾을 수 없어요: ${req.weeklyGoalId}")
        requireDateInWeek(req.date, weeklyGoal)
        val plan = weeklyPlanRepository.save(
            WeeklyPlan(weeklyGoal, req.date, req.content.trim(), nextSortOrder(req.date)),
        )
        return WeeklyPlanResponse.from(plan)
    }

    fun update(id: Long, req: WeeklyPlanUpdateRequest): WeeklyPlanResponse {
        val plan = getEntity(id)
        requireDateInWeek(req.date, plan.weeklyGoal)
        // 다른 요일로 옮기면 그날의 맨 뒤로 간다
        if (req.date != plan.date) plan.sortOrder = nextSortOrder(req.date)
        plan.date = req.date
        plan.content = req.content.trim()
        return WeeklyPlanResponse.from(plan)
    }

    fun delete(id: Long) {
        weeklyPlanRepository.delete(getEntity(id))
    }

    private fun requireDateInWeek(date: LocalDate, weeklyGoal: WeeklyGoal) {
        if (date.isBefore(weeklyGoal.weekStart) || date.isAfter(weeklyGoal.weekStart.plusDays(6))) {
            throw BusinessRuleException("계획 날짜는 주간 목표의 주 안이어야 해요.", "DATE_OUT_OF_WEEK")
        }
    }

    private fun nextSortOrder(date: LocalDate) = weeklyPlanRepository.countByDate(date).toInt() + 1

    private fun getEntity(id: Long): WeeklyPlan =
        weeklyPlanRepository.findByIdOrNull(id) ?: throw NotFoundException("주간 계획을 찾을 수 없어요: $id")
}
