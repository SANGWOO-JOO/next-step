package com.jobscheduler.stats.dto

import com.jobscheduler.goal.dto.CategoryRef
import java.time.LocalDate

enum class StatsUnit { DAY, WEEK, MONTH }

data class StatsSummaryResponse(
    val from: LocalDate,
    val to: LocalDate,
    val days: Int,
    /** 순 공부시간 = 집중 + 수동 기록 */
    val totalSeconds: Long,
    val focusSeconds: Long,
    val manualSeconds: Long,
    val distractionSeconds: Long,
    val dailyAverageSeconds: Long,
    /** 딴짓 / (집중 + 딴짓). 둘 다 0이면 0 */
    val distractionRatio: Double,
    /** 기간 중 공부한 날 수 */
    val studyDays: Int,
    /** to부터 거꾸로 센 연속 공부일 (to에 공부가 없으면 전날부터) */
    val streakDays: Int,
    /** 활성 분류의 주간 목표 시간 합 × 일수 / 7. 정한 분류가 없으면 null */
    val targetSeconds: Long?,
)

data class CategoryStat(
    /** null이면 미분류 */
    val category: CategoryRef?,
    val seconds: Long,
    /** 전체 순 공부시간 대비 0~1 */
    val ratio: Double,
    val targetRatio: Int?,
    val targetSeconds: Long?,
)

data class SeriesValue(val categoryId: Long?, val seconds: Long)

data class SeriesBucket(val start: LocalDate, val totalSeconds: Long, val byCategory: List<SeriesValue>)

data class TimeseriesResponse(val unit: StatsUnit, val categories: List<CategoryRef>, val buckets: List<SeriesBucket>)

/** dayOfWeek: 1(월)~7(일), hour: 0~23 */
data class HeatmapCell(val dayOfWeek: Int, val hour: Int, val seconds: Long)

data class HeatmapResponse(val cells: List<HeatmapCell>, val maxSeconds: Long)
