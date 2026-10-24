package com.jobscheduler.user

import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.common.NotFoundException
import com.jobscheduler.daily.DailyGoalService
import com.jobscheduler.daily.dto.DailyGoalCreateRequest
import com.jobscheduler.goal.GoalService
import com.jobscheduler.stats.StudySliceCollector
import com.jobscheduler.timeblock.TimeBlockService
import com.jobscheduler.timeblock.dto.TimeBlockRequest
import com.jobscheduler.user.dto.MeResponse
import com.jobscheduler.user.dto.OnboardingRequest
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.DayOfWeek
import java.time.LocalDate

/**
 * 시작 설정(docs/design.md 11-3, 11-6 2-3). 마지막에 한 번에 저장한다:
 * 목적 → 첫 목표 → 칠한 칸마다 그날 할 일(같은 날은 하나)과 블록 → onboarded.
 */
@Service
@Transactional
class OnboardingService(
    private val userRepository: AppUserRepository,
    private val goalService: GoalService,
    private val dailyGoalService: DailyGoalService,
    private val timeBlockService: TimeBlockService,
    private val clock: Clock,
) {
    fun complete(req: OnboardingRequest): MeResponse {
        val user = currentUser()
        if (user.onboarded) throw BusinessRuleException("이미 시작 설정을 마쳤어요.", "ALREADY_ONBOARDED")

        val today = LocalDate.now(clock.withZone(StudySliceCollector.ZONE))
        val sunday = today.with(DayOfWeek.MONDAY).plusDays(6)
        val byDate = req.blocks.groupBy { it.startAt.atZoneSameInstant(StudySliceCollector.ZONE).toLocalDate() }
        // 오늘 이후의 이번 주 칸에만 만든다(2-3 ③)
        byDate.keys.firstOrNull { it.isBefore(today) || it.isAfter(sunday) }?.let {
            throw BusinessRuleException("이번 주 오늘 이후 칸만 칠할 수 있어요: $it", "BLOCK_OUT_OF_WEEK")
        }

        val goal = goalService.create(req.goal)
        byDate.toSortedMap().forEach { (date, blocks) ->
            val daily = dailyGoalService.create(
                DailyGoalCreateRequest(goalId = goal.id, date = date, content = goal.title, categoryId = goal.category.id),
            )
            blocks.sortedBy { it.startAt }.forEach {
                timeBlockService.create(TimeBlockRequest(daily.id, startAt = it.startAt, endAt = it.endAt))
            }
        }
        user.purpose = req.purpose
        user.onboarded = true
        return MeResponse.from(user)
    }

    /** 이미 쓰던 사람은 건너뛴다(2-3 ⑤). 아무것도 만들지 않는다 */
    fun skip(): MeResponse {
        val user = currentUser()
        user.onboarded = true
        return MeResponse.from(user)
    }

    private fun currentUser(): AppUser =
        userRepository.findByIdOrNull(CurrentUser.id()) ?: throw NotFoundException("사용자를 찾을 수 없어요")
}
