package com.jobscheduler.record.dto

import com.jobscheduler.goal.dto.CategoryRef
import com.jobscheduler.record.ManualStudyLog
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.Size
import java.time.LocalDate
import java.time.OffsetDateTime

data class ManualStudyLogRequest(
    val date: LocalDate,
    val categoryId: Long,
    @field:Min(1, message = "공부 시간은 1분 이상이어야 해요.")
    @field:Max(600, message = "공부 시간은 600분 이하여야 해요.")
    val minutes: Int,
    @field:Size(max = 500, message = "메모는 500자 이하로 입력해주세요.")
    val memo: String? = null,
)

data class ManualStudyLogResponse(
    val id: Long,
    val date: LocalDate,
    val category: CategoryRef,
    val minutes: Int,
    val memo: String?,
) {
    companion object {
        fun from(m: ManualStudyLog) = ManualStudyLogResponse(m.id!!, m.date, CategoryRef.from(m.category), m.minutes, m.memo)
    }
}

data class DailyLogRequest(
    @field:Size(max = 2000, message = "메모는 2000자 이하로 입력해주세요.")
    val memo: String? = null,
    @field:Min(1, message = "컨디션은 1~5로 골라주세요.")
    @field:Max(5, message = "컨디션은 1~5로 골라주세요.")
    val condition: Int? = null,
)

/** 그날 자동 집계. 진행 중 세션은 응답 시각까지 계산한다. */
data class DailySummary(
    val focusSeconds: Long,
    val distractionSeconds: Long,
    val sessionCount: Int,
    val manualMinutes: Int,
    val goalsDone: Int,
    val goalsTotal: Int,
)

data class DailyLogResponse(
    val date: LocalDate,
    /** 아직 기록을 저장하지 않았으면 false */
    val saved: Boolean,
    val memo: String?,
    val condition: Int?,
    val updatedAt: OffsetDateTime?,
    val summary: DailySummary,
)
