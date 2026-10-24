package com.jobscheduler.daily

import com.jobscheduler.category.CategoryService
import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.common.NotFoundException
import com.jobscheduler.daily.dto.DailyGoalCreateRequest
import com.jobscheduler.daily.dto.DailyGoalMoveResponse
import com.jobscheduler.daily.dto.DailyGoalResponse
import com.jobscheduler.daily.dto.DailyGoalUpdateRequest
import com.jobscheduler.actual.ActualKind
import com.jobscheduler.actual.ActualLogRepository
import com.jobscheduler.focus.FocusSessionRepository
import com.jobscheduler.goal.Goal
import com.jobscheduler.goal.GoalRepository
import com.jobscheduler.goal.GoalStatus
import com.jobscheduler.timeblock.TimeBlockRepository
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.time.temporal.ChronoUnit

@Service
@Transactional
class DailyGoalService(
    private val dailyGoalRepository: DailyGoalRepository,
    private val goalRepository: GoalRepository,
    private val categoryService: CategoryService,
    private val timeBlockRepository: TimeBlockRepository,
    private val focusSessionRepository: FocusSessionRepository,
    private val actualLogRepository: ActualLogRepository,
) {
    companion object {
        const val MAX_CORE = 3
        const val MAX_RANGE_DAYS = 62L
        private val ORDER = compareBy<DailyGoal>({ it.date }, { it.type }, { it.sortOrder }, { it.id })
    }

    @Transactional(readOnly = true)
    fun list(from: LocalDate, to: LocalDate): List<DailyGoalResponse> {
        if (to.isBefore(from) || ChronoUnit.DAYS.between(from, to) > MAX_RANGE_DAYS) {
            throw BusinessRuleException("조회 기간은 $MAX_RANGE_DAYS 일 이내여야 해요.", "INVALID_RANGE")
        }
        return dailyGoalRepository.findAllByDateBetween(from, to).sortedWith(ORDER).map(DailyGoalResponse::from)
    }

    /** before 이전 날짜의 미완료 하루 목표 (재배치용) */
    @Transactional(readOnly = true)
    fun unfinished(before: LocalDate): List<DailyGoalResponse> =
        dailyGoalRepository.findAllByDateBeforeAndStatus(before, DailyGoalStatus.TODO)
            .sortedWith(ORDER)
            .map(DailyGoalResponse::from)

    fun create(req: DailyGoalCreateRequest): DailyGoalResponse {
        val category = req.categoryId?.let(categoryService::getAssignable)
        // 목표를 고르지 않았어도 그 분류의 진행 중 목표가 하나뿐이면 거기에 묶는다(docs/design.md 11-6 2-2 ⑨)
        val goal = req.goalId?.let(::getGoal)
            ?: category?.let { c -> goalRepository.findAllByCategoryIdAndStatus(c.id!!, GoalStatus.ACTIVE).singleOrNull() }

        val coreCount = dailyGoalRepository.countByDateAndType(req.date, DailyGoalType.CORE)
        val type = req.type ?: if (coreCount < MAX_CORE) DailyGoalType.CORE else DailyGoalType.EXTRA
        if (type == DailyGoalType.CORE && coreCount >= MAX_CORE) throw coreLimit()

        val dailyGoal = dailyGoalRepository.save(
            DailyGoal(
                goal = goal,
                date = req.date,
                content = req.content.trim(),
                firstAction = req.firstAction?.trim()?.ifEmpty { null },
                // 분류를 고르지 않으면 묶은 목표의 분류를 물려받는다
                category = category ?: goal?.category,
                type = type,
                sortOrder = nextSortOrder(req.date, type),
            ),
        )
        return DailyGoalResponse.from(dailyGoal)
    }

    fun update(id: Long, req: DailyGoalUpdateRequest): DailyGoalResponse {
        val dailyGoal = getEntity(id)
        // 이미 지정된 분류는 비활성이어도 유지하고, 새로 지정할 때만 활성 여부를 본다
        if (req.categoryId != dailyGoal.category?.id) {
            dailyGoal.category = req.categoryId?.let(categoryService::getAssignable)
        }
        dailyGoal.content = req.content.trim()
        dailyGoal.firstAction = req.firstAction?.trim()?.ifEmpty { null }
        dailyGoal.status = req.status
        return DailyGoalResponse.from(dailyGoal)
    }

    /** 하루 목표와 그 목표의 시간 블록을 함께 지운다. 집중 세션은 기록으로 남기고 연결만 끊는다. */
    fun delete(id: Long) {
        val dailyGoal = getEntity(id)
        deleteTimeBlocks(id)
        focusSessionRepository.findAllByDailyGoalId(id).forEach { it.dailyGoal = null }
        // 실제 기록은 남기고 목표 연결만 끊는다(분류가 있으면 공부, 없으면 기타 일정으로, 이름은 목표 내용으로)
        actualLogRepository.findAllByDailyGoalId(id).forEach {
            it.kind = if (it.category != null) ActualKind.STUDY else ActualKind.OTHER
            it.title = dailyGoal.content.take(100)
            it.dailyGoal = null
        }
        dailyGoalRepository.delete(dailyGoal)
    }

    /** 목표에 묶거나 푼다(2-2). 분류가 없으면 목표의 분류를 물려받는다 */
    fun link(id: Long, goalId: Long?): DailyGoalResponse {
        val dailyGoal = getEntity(id)
        val goal = goalId?.let(::getGoal)
        dailyGoal.goal = goal
        if (dailyGoal.category == null) dailyGoal.category = goal?.category
        return DailyGoalResponse.from(dailyGoal)
    }

    /**
     * 다른 날로 넘긴다. 묶인 목표는 그대로 둔다.
     * 넘길 날에 핵심이 이미 3개면 추가(EXTRA)로 넣는다. 원래 날의 시간 블록은 지운다.
     */
    fun move(id: Long, date: LocalDate): DailyGoalMoveResponse {
        val dailyGoal = getEntity(id)
        if (dailyGoal.status == DailyGoalStatus.DONE) {
            throw BusinessRuleException("완료한 목표는 넘길 수 없어요.", "ALREADY_DONE")
        }
        if (date == dailyGoal.date) {
            throw BusinessRuleException("같은 날짜로는 넘길 수 없어요.", "SAME_DATE")
        }

        val downgraded = dailyGoal.type == DailyGoalType.CORE &&
            dailyGoalRepository.countByDateAndType(date, DailyGoalType.CORE) >= MAX_CORE
        val type = if (downgraded) DailyGoalType.EXTRA else dailyGoal.type

        dailyGoal.date = date
        dailyGoal.type = type
        dailyGoal.sortOrder = nextSortOrder(date, type)
        dailyGoal.carryCount += 1
        val removedBlocks = deleteTimeBlocks(id)
        return DailyGoalMoveResponse(DailyGoalResponse.from(dailyGoal), downgraded, removedBlocks)
    }

    /** 핵심 ↔ 추가 전환. 바뀐 유형의 맨 뒤로 간다. */
    fun changeType(id: Long, type: DailyGoalType): DailyGoalResponse {
        val dailyGoal = getEntity(id)
        if (dailyGoal.type == type) return DailyGoalResponse.from(dailyGoal)
        if (type == DailyGoalType.CORE &&
            dailyGoalRepository.countByDateAndType(dailyGoal.date, DailyGoalType.CORE) >= MAX_CORE
        ) {
            throw coreLimit()
        }
        dailyGoal.sortOrder = nextSortOrder(dailyGoal.date, type)
        dailyGoal.type = type
        return DailyGoalResponse.from(dailyGoal)
    }

    /** 같은 날·같은 유형의 하루 목표를 ids 순서대로 정렬한다. 빠짐없이 보내야 한다. */
    fun reorder(date: LocalDate, type: DailyGoalType, ids: List<Long>): List<DailyGoalResponse> {
        val goals = dailyGoalRepository.findAllByDateAndType(date, type)
        if (ids.size != ids.toSet().size || ids.toSet() != goals.map { it.id!! }.toSet()) {
            throw BusinessRuleException("그날의 같은 유형 목표를 한 번씩 모두 보내야 해요.", "INVALID_ORDER")
        }
        val byId = goals.associateBy { it.id!! }
        ids.forEachIndexed { index, id -> byId.getValue(id).sortOrder = index + 1 }
        return ids.map { DailyGoalResponse.from(byId.getValue(it)) }
    }

    /** 하루 목표의 시간 블록을 지우고 지운 개수를 돌려준다. */
    private fun deleteTimeBlocks(dailyGoalId: Long): Int {
        val blocks = timeBlockRepository.findAllByDailyGoalId(dailyGoalId)
        timeBlockRepository.deleteAll(blocks)
        return blocks.size
    }

    private fun nextSortOrder(date: LocalDate, type: DailyGoalType) =
        (dailyGoalRepository.findAllByDateAndType(date, type).maxOfOrNull { it.sortOrder } ?: 0) + 1

    private fun coreLimit() =
        BusinessRuleException("핵심 목표는 하루 ${MAX_CORE}개까지예요. 추가 목록으로 넣어주세요.", "CORE_LIMIT")

    private fun getGoal(id: Long): Goal =
        goalRepository.findByIdOrNull(id) ?: throw NotFoundException("목표를 찾을 수 없어요: $id")

    private fun getEntity(id: Long): DailyGoal =
        dailyGoalRepository.findByIdOrNull(id) ?: throw NotFoundException("하루 목표를 찾을 수 없어요: $id")
}
