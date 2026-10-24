package com.jobscheduler.focus

import com.jobscheduler.category.CategoryService
import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.common.NotFoundException
import com.jobscheduler.daily.DailyGoalRepository
import com.jobscheduler.daily.DailyGoalStatus
import com.jobscheduler.focus.dto.FocusSessionResponse
import com.jobscheduler.focus.dto.FocusStartRequest
import com.jobscheduler.focus.dto.InterruptionEndRequest
import com.jobscheduler.focus.dto.InterruptionStartRequest
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.LocalDate
import java.time.OffsetDateTime

@Service
@Transactional
class FocusSessionService(
    private val sessionRepository: FocusSessionRepository,
    private val noteRepository: DistractionNoteRepository,
    private val dailyGoalRepository: DailyGoalRepository,
    private val categoryService: CategoryService,
    private val clock: Clock,
) {
    private fun now(): OffsetDateTime = OffsetDateTime.now(clock)

    @Transactional(readOnly = true)
    fun current(): FocusSessionResponse? = sessionRepository.findFirstByEndedAtIsNullOrderByStartedAtDesc()?.let(::toResponse)

    @Transactional(readOnly = true)
    fun listByDate(date: LocalDate): List<FocusSessionResponse> =
        sessionRepository.findAllByDateOrderByStartedAtAsc(date).map(::toResponse)

    @Transactional(readOnly = true)
    fun get(id: Long): FocusSessionResponse = toResponse(getEntity(id))

    /** 진행 중 세션은 1개뿐이다. 하루 목표 없이 분류만으로도 시작할 수 있다. */
    fun start(req: FocusStartRequest): FocusSessionResponse {
        sessionRepository.findFirstByEndedAtIsNullOrderByStartedAtDesc()?.let {
            throw BusinessRuleException("이미 진행 중인 집중 세션이 있어요.", "SESSION_ALREADY_RUNNING")
        }
        val dailyGoal = req.dailyGoalId?.let {
            dailyGoalRepository.findByIdOrNull(it) ?: throw NotFoundException("할 일을 찾을 수 없어요: $it")
        }
        if (dailyGoal == null && req.categoryId == null) {
            throw BusinessRuleException("할 일이나 목표 중 하나는 골라주세요.", "GOAL_OR_CATEGORY_REQUIRED")
        }
        val now = now()
        val session = sessionRepository.save(
            FocusSession(
                dailyGoal = dailyGoal,
                // 분류를 고르지 않으면 하루 목표의 분류를 물려받는다
                category = req.categoryId?.let(categoryService::getAssignable) ?: dailyGoal?.category,
                date = now.toLocalDate(),
                startedAt = now,
                focusMinutes = req.focusMinutes,
                breakMinutes = req.breakMinutes,
                source = req.source,
            ),
        )
        return toResponse(session)
    }

    /** 세션을 끝내고 실제 집중 시간을 저장한다. 완료를 고르면 하루 목표도 완료로 바꾼다. */
    fun end(id: Long, result: FocusResult): FocusSessionResponse {
        val session = getRunning(id)
        if (session.openInterruption != null) {
            throw BusinessRuleException("진행 중인 중단을 먼저 끝내주세요.", "INTERRUPTION_OPEN")
        }
        session.endedAt = now()
        session.result = result
        session.focusSeconds = FocusTime.calculate(session, session.endedAt!!).focusSeconds
        if (result == FocusResult.COMPLETED) session.dailyGoal?.status = DailyGoalStatus.DONE
        return toResponse(session)
    }

    /** 분류는 진행 중이든 끝난 뒤든 바꿀 수 있다. 이미 지정된 비활성 분류는 그대로 둘 수 있다. */
    fun changeCategory(id: Long, categoryId: Long?): FocusSessionResponse {
        val session = getEntity(id)
        if (categoryId != session.category?.id) {
            session.category = categoryId?.let(categoryService::getAssignable)
        }
        return toResponse(session)
    }

    /** 중단 시작. 한 세션에 열린 중단은 1개이고, 이전 중단과 겹치게 시작할 수 없다. */
    fun startInterruption(sessionId: Long, req: InterruptionStartRequest): FocusSessionResponse {
        val session = getRunning(sessionId)
        if (session.openInterruption != null) {
            throw BusinessRuleException("이미 진행 중인 중단이 있어요.", "INTERRUPTION_OPEN")
        }
        val now = now()
        val startedAt = req.startedAt ?: now
        val lastEnd = session.interruptions.mapNotNull { it.endedAt }.maxOrNull()
        if (startedAt.isBefore(session.startedAt) || startedAt.isAfter(now) ||
            (lastEnd != null && startedAt.isBefore(lastEnd))
        ) {
            throw BusinessRuleException("중단 시작 시각이 올바르지 않아요.", "INVALID_INTERRUPTION_TIME")
        }
        session.interruptions.add(Interruption(session, startedAt, req.detection))
        // 응답에 새 중단의 id가 필요하다
        return toResponse(sessionRepository.saveAndFlush(session))
    }

    /** 중단을 끝내면서 종류(딴짓/공부 자료/휴식)를 정한다. */
    fun endInterruption(sessionId: Long, interruptionId: Long, req: InterruptionEndRequest): FocusSessionResponse {
        val session = getRunning(sessionId)
        val interruption = session.interruptions.firstOrNull { it.id == interruptionId }
            ?: throw NotFoundException("중단을 찾을 수 없어요: $interruptionId")
        if (interruption.endedAt != null) {
            throw BusinessRuleException("이미 끝난 중단이에요.", "INTERRUPTION_ALREADY_ENDED")
        }
        val now = now()
        val endedAt = req.endedAt ?: now
        if (endedAt.isBefore(interruption.startedAt) || endedAt.isAfter(now)) {
            throw BusinessRuleException("중단 종료 시각이 올바르지 않아요.", "INVALID_INTERRUPTION_TIME")
        }
        interruption.endedAt = endedAt
        interruption.type = req.type
        interruption.memo = req.memo?.trim()?.ifEmpty { null }
        return toResponse(session)
    }

    private fun toResponse(session: FocusSession): FocusSessionResponse {
        val time = FocusTime.calculate(session, now())
        val notes = noteRepository.findAllBySessionIdOrderByCreatedAtAsc(session.id!!)
        return FocusSessionResponse.from(session, notes, session.focusSeconds ?: time.focusSeconds, time.pausedSeconds)
    }

    private fun getRunning(id: Long): FocusSession {
        val session = getEntity(id)
        if (!session.running) throw BusinessRuleException("이미 끝난 집중 세션이에요.", "SESSION_ENDED")
        return session
    }

    internal fun getEntity(id: Long): FocusSession =
        sessionRepository.findByIdOrNull(id) ?: throw NotFoundException("집중 세션을 찾을 수 없어요: $id")
}
