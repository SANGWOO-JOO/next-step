package com.jobscheduler.focus.dto

import com.jobscheduler.daily.DailyGoalStatus
import com.jobscheduler.focus.DistractionNote
import com.jobscheduler.focus.FocusResult
import com.jobscheduler.focus.FocusSession
import com.jobscheduler.focus.FocusSource
import com.jobscheduler.focus.Interruption
import com.jobscheduler.focus.InterruptionDetection
import com.jobscheduler.focus.InterruptionType
import com.jobscheduler.goal.dto.CategoryRef
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import java.time.LocalDate
import java.time.OffsetDateTime

data class FocusStartRequest(
    /** 비우면 분류만으로 시작한다. 하루 목표와 분류 중 하나는 있어야 한다. */
    val dailyGoalId: Long? = null,
    /** 비우면 하루 목표의 분류를 물려받는다. */
    val categoryId: Long? = null,
    @field:Min(1, message = "집중 시간은 1분 이상이어야 해요.")
    @field:Max(180, message = "집중 시간은 180분 이하여야 해요.")
    val focusMinutes: Int = 25,
    @field:Min(0, message = "휴식 시간은 0분 이상이어야 해요.")
    @field:Max(60, message = "휴식 시간은 60분 이하여야 해요.")
    val breakMinutes: Int = 5,
    val source: FocusSource = FocusSource.FOCUS_PAGE,
)

data class FocusEndRequest(val result: FocusResult)

data class FocusCategoryRequest(val categoryId: Long?)

data class InterruptionStartRequest(
    val detection: InterruptionDetection = InterruptionDetection.BUTTON,
    /** 탭 이탈은 탭을 벗어난 시각을 보낸다. 비우면 지금 */
    val startedAt: OffsetDateTime? = null,
)

data class InterruptionEndRequest(
    val type: InterruptionType,
    @field:Size(max = 500, message = "메모는 500자 이하로 입력해주세요.")
    val memo: String? = null,
    /** 탭 이탈은 돌아온 시각을 보낸다. 비우면 지금 */
    val endedAt: OffsetDateTime? = null,
)

data class DistractionNoteRequest(
    @field:NotBlank(message = "메모를 입력해주세요.")
    @field:Size(max = 500, message = "메모는 500자 이하로 입력해주세요.")
    val content: String,
)

data class DistractionNoteCheckRequest(val checked: Boolean)

data class FocusGoalRef(val id: Long, val content: String, val firstAction: String?, val status: DailyGoalStatus)

data class InterruptionResponse(
    val id: Long,
    val startedAt: OffsetDateTime,
    val endedAt: OffsetDateTime?,
    val type: InterruptionType?,
    val detection: InterruptionDetection,
    val memo: String?,
) {
    companion object {
        fun from(i: Interruption) = InterruptionResponse(i.id!!, i.startedAt, i.endedAt, i.type, i.detection, i.memo)
    }
}

data class DistractionNoteResponse(
    val id: Long,
    val sessionId: Long,
    val sessionDate: LocalDate,
    val dailyGoalContent: String?,
    val content: String,
    val checked: Boolean,
    val createdAt: OffsetDateTime,
) {
    companion object {
        fun from(n: DistractionNote) = DistractionNoteResponse(
            id = n.id!!,
            sessionId = n.session.id!!,
            sessionDate = n.session.date,
            dailyGoalContent = n.session.dailyGoal?.content,
            content = n.content,
            checked = n.checked,
            createdAt = n.createdAt,
        )
    }
}

data class FocusSessionResponse(
    val id: Long,
    val dailyGoal: FocusGoalRef?,
    val category: CategoryRef?,
    val date: LocalDate,
    val startedAt: OffsetDateTime,
    val endedAt: OffsetDateTime?,
    val focusMinutes: Int,
    val breakMinutes: Int,
    /** 실제 집중 시간(초). 진행 중이면 응답 시각까지 계산한 값 */
    val focusSeconds: Long,
    /** 딴짓·휴식으로 뺀 시간(초) */
    val pausedSeconds: Long,
    val result: FocusResult?,
    val completed: Boolean,
    val source: FocusSource,
    val running: Boolean,
    val interruptions: List<InterruptionResponse>,
    val notes: List<DistractionNoteResponse>,
) {
    companion object {
        fun from(s: FocusSession, notes: List<DistractionNote>, focusSeconds: Long, pausedSeconds: Long) =
            FocusSessionResponse(
                id = s.id!!,
                dailyGoal = s.dailyGoal?.let { FocusGoalRef(it.id!!, it.content, it.firstAction, it.status) },
                category = s.category?.let(CategoryRef::from),
                date = s.date,
                startedAt = s.startedAt,
                endedAt = s.endedAt,
                focusMinutes = s.focusMinutes,
                breakMinutes = s.breakMinutes,
                focusSeconds = focusSeconds,
                pausedSeconds = pausedSeconds,
                result = s.result,
                completed = s.completed,
                source = s.source,
                running = s.running,
                interruptions = s.interruptions.map(InterruptionResponse::from),
                notes = notes.map(DistractionNoteResponse::from),
            )
    }
}
