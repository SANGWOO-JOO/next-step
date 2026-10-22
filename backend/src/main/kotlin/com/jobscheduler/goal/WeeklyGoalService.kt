package com.jobscheduler.goal

import com.jobscheduler.category.CategoryService
import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.common.NotFoundException
import com.jobscheduler.daily.DailyGoalRepository
import com.jobscheduler.goal.dto.WeeklyGoalCreateRequest
import com.jobscheduler.goal.dto.WeeklyGoalResponse
import com.jobscheduler.goal.dto.WeeklyGoalUpdateRequest
import com.jobscheduler.plan.WeeklyPlanRepository
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
    private val dailyGoalRepository: DailyGoalRepository,
    private val weeklyPlanRepository: WeeklyPlanRepository,
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
        // 하루 목표가 연결돼 있으면 주를 바꿀 수 없다(하루 목표 날짜가 주 밖으로 나가므로)
        if (req.weekStart != weeklyGoal.weekStart && dailyGoalRepository.existsByWeeklyGoalId(id)) {
            throw BusinessRuleException("하루 목표가 연결된 주간 목표는 주를 바꿀 수 없어요.", "HAS_CHILDREN")
        }
        if (req.weekStart != weeklyGoal.weekStart && weeklyPlanRepository.existsByWeeklyGoalId(id)) {
            throw BusinessRuleException("요일별 계획이 있는 주간 목표는 주를 바꿀 수 없어요.", "HAS_CHILDREN")
        }

        // 이미 지정된 분류는 나중에 비활성화돼도 유지할 수 있고, 새로 지정할 때만 활성 여부를 본다
        if (req.categoryId != weeklyGoal.category?.id) {
            weeklyGoal.category = req.categoryId?.let(categoryService::getAssignable)
        }
        weeklyGoal.weekStart = req.weekStart
        weeklyGoal.content = req.content.trim()
        weeklyGoal.achieved = req.achieved
        return WeeklyGoalResponse.from(weeklyGoal)
    }

    /**
     * 못 끝낸 주간 목표를 다음 주에 같은 내용·분류로 새로 만들고 원래 목표에 이어감 표시를 한다.
     * 다음 주가 다른 달이면 그 달의 월간 목표(monthlyGoalId)가 필요하다.
     */
    fun carryOver(id: Long, monthlyGoalId: Long?): WeeklyGoalResponse {
        val weeklyGoal = getEntity(id)
        if (weeklyGoal.achieved) throw BusinessRuleException("달성한 주간 목표는 이어갈 수 없어요.", "ALREADY_ACHIEVED")
        if (weeklyGoal.carriedOver) throw BusinessRuleException("이미 다음 주로 이어간 목표예요.", "ALREADY_CARRIED")

        val nextWeek = weeklyGoal.weekStart.plusWeeks(1)
        val monthlyGoal = when {
            monthlyGoalId != null -> monthlyGoalRepository.findByIdOrNull(monthlyGoalId)
                ?: throw NotFoundException("월간 목표를 찾을 수 없어요: $monthlyGoalId")
            GoalRules.isoMonthOf(nextWeek) == weeklyGoal.monthlyGoal.month -> weeklyGoal.monthlyGoal
            else -> throw BusinessRuleException(
                "다음 주는 ${GoalRules.isoMonthOf(nextWeek)}에 속해서 그 달의 월간 목표를 골라야 해요.",
                "MONTHLY_GOAL_REQUIRED",
            )
        }
        GoalRules.requireWeekInMonth(nextWeek, monthlyGoal.month)

        weeklyGoal.carriedOver = true
        val next = weeklyGoalRepository.save(
            WeeklyGoal(monthlyGoal = monthlyGoal, weekStart = nextWeek, content = weeklyGoal.content, category = weeklyGoal.category),
        )
        return WeeklyGoalResponse.from(next)
    }

    /** 요일별 계획은 함께 지운다. 하루 목표가 있으면 지울 수 없다. */
    fun delete(id: Long) {
        val weeklyGoal = getEntity(id)
        if (dailyGoalRepository.existsByWeeklyGoalId(id)) {
            throw BusinessRuleException("하루 목표가 연결된 주간 목표는 삭제할 수 없어요.", "HAS_CHILDREN")
        }
        weeklyPlanRepository.deleteAll(weeklyPlanRepository.findAllByWeeklyGoalId(id))
        weeklyGoalRepository.delete(weeklyGoal)
    }

    private fun getEntity(id: Long): WeeklyGoal =
        weeklyGoalRepository.findByIdOrNull(id) ?: throw NotFoundException("주간 목표를 찾을 수 없어요: $id")
}
