package com.jobscheduler.review.dto

import com.jobscheduler.record.dto.DailySummary
import jakarta.validation.constraints.Size
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.YearMonth

data class WeeklyJournalRequest(
    @field:Size(max = 2000, message = "잘한 점은 2000자 이하로 입력해주세요.")
    val good: String? = null,
    @field:Size(max = 2000, message = "아쉬운 점은 2000자 이하로 입력해주세요.")
    val bad: String? = null,
    @field:Size(max = 2000, message = "다음 주 반영은 2000자 이하로 입력해주세요.")
    val nextAction: String? = null,
)

data class MonthlyReviewRequest(
    @field:Size(max = 4000, message = "회고는 4000자 이하로 입력해주세요.")
    val review: String? = null,
    @field:Size(max = 2000, message = "다음 달 방향은 2000자 이하로 입력해주세요.")
    val nextDirection: String? = null,
)

/** 하루 요약 + 그날 하루 기록의 컨디션 */
data class DayStats(val date: LocalDate, val condition: Int?, val summary: DailySummary)

/** 한 주의 합계 */
data class WeekStats(
    val weekStart: LocalDate,
    /** 하루 요약의 공부 시간 합(실제 기록 기준, 없는 날은 지난 집중 세션 + 수동 기록) */
    val studySeconds: Long,
    val focusSeconds: Long,
    val manualMinutes: Int,
    val distractionSeconds: Long,
    val goalsDone: Int,
    val goalsTotal: Int,
    val weeklyGoalsAchieved: Int,
    val weeklyGoalsTotal: Int,
    val journalWritten: Boolean,
)

data class WeeklyJournalResponse(
    val weekStart: LocalDate,
    /** 아직 저장하지 않았으면 false */
    val saved: Boolean,
    val good: String?,
    val bad: String?,
    val nextAction: String?,
    val aiSummary: String?,
    val updatedAt: OffsetDateTime?,
    val days: List<DayStats>,
    val total: WeekStats,
)

data class MonthlyReviewResponse(
    val month: YearMonth,
    val saved: Boolean,
    val review: String?,
    val nextDirection: String?,
    val aiSummary: String?,
    val updatedAt: OffsetDateTime?,
    /** 그 달에 속한 주(목요일 기준)별 합계 */
    val weeks: List<WeekStats>,
)

/** 회고 목록용 요약(집계 없이 저장한 글만) */
data class MonthlyReviewBrief(
    val month: YearMonth,
    val review: String?,
    val nextDirection: String?,
    val aiSummary: String?,
    val updatedAt: OffsetDateTime,
)

/** 일지 모음용 요약(집계 없이 저장한 글만) */
data class WeeklyJournalBrief(
    val weekStart: LocalDate,
    val good: String?,
    val bad: String?,
    val nextAction: String?,
    val updatedAt: OffsetDateTime,
)
