package com.jobscheduler.actual.dto

import com.jobscheduler.actual.ActualKind
import com.jobscheduler.actual.ActualLog
import com.jobscheduler.goal.dto.CategoryRef
import jakarta.validation.constraints.Size
import java.time.LocalDate
import java.time.OffsetDateTime

data class ActualLogRequest(
    val date: LocalDate,
    val startAt: OffsetDateTime,
    val endAt: OffsetDateTime,
    val kind: ActualKind,
    /** GOAL일 때 필수(그날의 하루 목표) */
    val dailyGoalId: Long? = null,
    /** STUDY일 때 필수 */
    val categoryId: Long? = null,
    /** DISTRACTION은 선택, OTHER는 필수 */
    @field:Size(max = 100, message = "제목은 100자 이하로 입력해주세요.")
    val title: String? = null,
)

data class ActualLogResponse(
    val id: Long,
    val date: LocalDate,
    val startAt: OffsetDateTime,
    val endAt: OffsetDateTime,
    val kind: ActualKind,
    val dailyGoalId: Long?,
    val category: CategoryRef?,
    val title: String?,
    /** 화면에 보여줄 이름 */
    val label: String,
    val timeBlockId: Long?,
) {
    companion object {
        fun from(a: ActualLog) = ActualLogResponse(
            id = a.id!!,
            date = a.date,
            startAt = a.startAt,
            endAt = a.endAt,
            kind = a.kind,
            dailyGoalId = a.dailyGoal?.id,
            category = a.category?.let(CategoryRef::from),
            title = a.title,
            label = a.label,
            timeBlockId = a.timeBlockId,
        )
    }
}

/** 계획(시간 블록)과 실제 기록 비교(docs/design.md 1-4e) */
data class PlanComparison(
    /** 그날 계획한 전체 분 */
    val plannedMinutes: Long,
    /** 지금까지 지나간 계획 분(오늘은 지금 시각까지, 지난 날은 전체). 계획대로 %의 분모 */
    val plannedSoFarMinutes: Long,
    /** 계획과 같은 일을 실제로 한 분 */
    val asPlannedMinutes: Long,
    /** 계획대로 % (지난 계획이 없으면 null) */
    val asPlannedPercent: Int?,
    /** 실제 공부(하루 목표 + 분류 공부) 분 */
    val actualStudyMinutes: Long,
    val actualDistractionMinutes: Long,
    val actualOtherMinutes: Long,
    /** 지나갔는데 실제 기록이 하나도 없는 계획 블록(하루 마무리 "실제 채우기" 목록) */
    val unrecordedBlocks: List<UnrecordedBlock>,
)

data class UnrecordedBlock(
    val blockId: Long,
    val label: String,
    val dailyGoalId: Long?,
    val startAt: OffsetDateTime,
    val endAt: OffsetDateTime,
)
