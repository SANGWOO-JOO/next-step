package com.jobscheduler.goal

import com.jobscheduler.actual.ActualKind
import com.jobscheduler.actual.ActualLogRepository
import com.jobscheduler.category.CategoryService
import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.common.NotFoundException
import com.jobscheduler.daily.DailyGoalRepository
import com.jobscheduler.goal.dto.GoalRequest
import com.jobscheduler.goal.dto.GoalResponse
import com.jobscheduler.goal.dto.GoalWeekRow
import com.jobscheduler.goal.dto.WeekPlanResponse
import com.jobscheduler.stats.StudySliceCollector
import com.jobscheduler.timeblock.TimeBlockRepository
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.DayOfWeek
import java.time.Duration
import java.time.LocalDate

@Service
@Transactional
class GoalService(
    private val goalRepository: GoalRepository,
    private val categoryService: CategoryService,
    private val dailyGoalRepository: DailyGoalRepository,
    private val timeBlockRepository: TimeBlockRepository,
    private val actualLogRepository: ActualLogRepository,
    private val clock: Clock,
) {
    companion object {
        /** 진행 중 목표 최대 개수(docs/design.md 11-6 2-2 ⑦) */
        const val MAX_ACTIVE = 3
    }

    @Transactional(readOnly = true)
    fun list(): List<GoalResponse> = goalRepository.findAllByOrderByIdAsc().map(GoalResponse::from)

    @Transactional(readOnly = true)
    fun get(id: Long): GoalResponse = GoalResponse.from(getEntity(id))

    fun create(req: GoalRequest): GoalResponse {
        requireActiveSlot()
        val icon = requireIcon(req.icon)
        val title = req.title.trim()
        // 같은 이름의 분류를 다른 목표가 쓰고 있으면 겹친다(목표와 분류는 1:1)
        categoryService.findByName(title)?.let { if (goalRepository.existsByCategoryId(it.id!!)) throw duplicateTitle(title) }
        val goal = goalRepository.save(
            Goal(title = title, category = categoryService.forGoal(title, req.color, icon, null), targetDate = req.targetDate, icon = icon),
        )
        linkLooseDailyGoals(goal)
        return GoalResponse.from(goal)
    }

    fun update(id: Long, req: GoalRequest): GoalResponse {
        val goal = getEntity(id)
        val icon = requireIcon(req.icon)
        val title = req.title.trim()
        if (goalRepository.existsByTitleAndIdNot(title, id)) throw duplicateTitle(title)
        // 목표 이름·색을 바꾸면 1:1 분류도 함께 바뀐다
        categoryService.forGoal(title, req.color, icon, goal.category)
        goal.title = title
        goal.targetDate = req.targetDate
        goal.icon = icon
        linkLooseDailyGoals(goal)
        return GoalResponse.from(goal)
    }

    /** 아는 아이콘 이름만 받는다. 비우면 기본 아이콘 */
    private fun requireIcon(icon: String?): String? {
        val name = icon?.trim()?.ifEmpty { null } ?: return null
        if (name !in GoalIcons.NAMES) throw BusinessRuleException("없는 아이콘이에요: $name", "UNKNOWN_ICON")
        return name
    }

    /** 완료로 바꿔도 기록과 묶인 할 일은 그대로 둔다. 다시 진행으로 돌릴 때만 개수를 본다 */
    fun changeStatus(id: Long, status: GoalStatus): GoalResponse {
        val goal = getEntity(id)
        if (status == GoalStatus.ACTIVE && goal.status != GoalStatus.ACTIVE) requireActiveSlot()
        goal.status = status
        linkLooseDailyGoals(goal)
        return GoalResponse.from(goal)
    }

    /** 목표를 지우면 주별 목표 시간도 지우고, 묶인 할 일은 연결만 푼다 */
    fun delete(id: Long) {
        val goal = getEntity(id)
        dailyGoalRepository.findAllByGoalId(id).forEach { it.goal = null }
        goalRepository.delete(goal)
    }

    /**
     * 계획 화면(docs/design.md 11-4): 목표마다 일정에 잡은 시간(묶인 할 일의 시간 블록),
     * 실제로 한 시간(묶인 할 일의 실제 기록). 진행 중 목표와, 지난 목표 중 이번 주에 시간이 있는 것을 보여 준다.
     */
    @Transactional(readOnly = true)
    fun week(weekStart: LocalDate): WeekPlanResponse {
        requireMonday(weekStart)
        val weekEnd = weekStart.plusDays(6)
        val scheduled = timeBlockRepository.findAllByDateBetween(weekStart, weekEnd)
            .mapNotNull { b -> b.dailyGoal?.goal?.id?.let { it to minutes(b.startAt, b.endAt) } }
            .groupBy({ it.first }, { it.second }).mapValues { it.value.sum() }
        val actual = actualLogRepository.findAllByDateBetween(weekStart, weekEnd)
            .filter { it.kind == ActualKind.GOAL || it.kind == ActualKind.STUDY }
            .mapNotNull { l -> l.dailyGoal?.goal?.id?.let { it to minutes(l.startAt, l.endAt) } }
            .groupBy({ it.first }, { it.second }).mapValues { it.value.sum() }

        val rows = goalRepository.findAllByOrderByIdAsc()
            .map { GoalWeekRow(GoalResponse.from(it), scheduled[it.id] ?: 0, actual[it.id] ?: 0) }
            .filter { it.goal.status == GoalStatus.ACTIVE || it.scheduledMinutes + it.actualMinutes > 0 }
        return WeekPlanResponse(
            weekStart = weekStart,
            goals = rows,
            scheduledMinutes = rows.sumOf { it.scheduledMinutes },
            actualMinutes = rows.sumOf { it.actualMinutes },
        )
    }

    /**
     * 할 일을 만든 뒤에 목표를 만들거나 분류를 바꿔도 자동 연결 규칙(2-2 ⑨)이 같게 적용되도록,
     * 그 분류의 진행 중 목표가 이 목표 하나뿐이면 이번 주부터의 묶이지 않은 같은 분류 할 일을 묶는다.
     */
    private fun linkLooseDailyGoals(goal: Goal) {
        if (goal.status != GoalStatus.ACTIVE) return
        val sameCategory = goalRepository.findAllByCategoryIdAndStatus(goal.category.id!!, GoalStatus.ACTIVE)
        if (sameCategory.singleOrNull()?.id != goal.id) return
        val monday = LocalDate.now(clock.withZone(StudySliceCollector.ZONE)).with(DayOfWeek.MONDAY)
        dailyGoalRepository.findAllByGoalIsNullAndCategoryIdAndDateGreaterThanEqual(goal.category.id!!, monday)
            .forEach { it.goal = goal }
    }

    fun getEntity(id: Long): Goal =
        goalRepository.findByIdOrNull(id) ?: throw NotFoundException("목표를 찾을 수 없어요: $id")

    private fun duplicateTitle(title: String) =
        BusinessRuleException("이미 있는 목표 이름이에요: $title", "DUPLICATE_GOAL")

    private fun requireActiveSlot() {
        if (goalRepository.countByStatus(GoalStatus.ACTIVE) >= MAX_ACTIVE) {
            throw BusinessRuleException(
                "진행 중인 목표는 ${MAX_ACTIVE}개까지예요. 하나를 완료하거나 지운 뒤 추가해 주세요.",
                "ACTIVE_GOAL_LIMIT",
            )
        }
    }

    private fun requireMonday(weekStart: LocalDate) {
        if (weekStart.dayOfWeek != DayOfWeek.MONDAY) {
            throw BusinessRuleException("주 시작일은 월요일이어야 해요: $weekStart", "WEEK_START_NOT_MONDAY")
        }
    }

    private fun minutes(from: java.time.OffsetDateTime, to: java.time.OffsetDateTime) =
        Duration.between(from, to).toMinutes().toInt().coerceAtLeast(0)
}
