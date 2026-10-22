package com.jobscheduler.stats

import com.jobscheduler.category.CategoryRepository
import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.goal.dto.CategoryRef
import com.jobscheduler.stats.dto.CategoryStat
import com.jobscheduler.stats.dto.HeatmapCell
import com.jobscheduler.stats.dto.HeatmapResponse
import com.jobscheduler.stats.dto.SeriesBucket
import com.jobscheduler.stats.dto.SeriesValue
import com.jobscheduler.stats.dto.StatsSummaryResponse
import com.jobscheduler.stats.dto.StatsUnit
import com.jobscheduler.stats.dto.TimeseriesResponse
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.temporal.ChronoUnit
import java.time.temporal.TemporalAdjusters

@Service
@Transactional(readOnly = true)
class StatsService(
    private val collector: StudySliceCollector,
    private val categoryRepository: CategoryRepository,
    private val clock: Clock,
) {
    companion object {
        const val MAX_RANGE_DAYS = 731L
        const val STREAK_LOOKBACK_DAYS = 365L
    }

    private fun now(): OffsetDateTime = OffsetDateTime.now(clock)

    private fun slices(from: LocalDate, to: LocalDate): List<StudySlice> {
        if (to.isBefore(from) || ChronoUnit.DAYS.between(from, to) >= MAX_RANGE_DAYS) {
            throw BusinessRuleException("조회 기간은 $MAX_RANGE_DAYS 일 이내여야 해요.", "INVALID_RANGE")
        }
        return collector.collect(from, to, now())
    }

    private fun List<StudySlice>.study() = filter { it.kind != SliceKind.DISTRACTION }

    private fun days(from: LocalDate, to: LocalDate) = ChronoUnit.DAYS.between(from, to).toInt() + 1

    fun summary(from: LocalDate, to: LocalDate): StatsSummaryResponse {
        val slices = slices(from, to)
        val days = days(from, to)
        val focus = slices.filter { it.kind == SliceKind.FOCUS }.sumOf { it.seconds }
        val manual = slices.filter { it.kind == SliceKind.MANUAL }.sumOf { it.seconds }
        val distraction = slices.filter { it.kind == SliceKind.DISTRACTION }.sumOf { it.seconds }
        val total = focus + manual
        val weeklyTargets = categoryRepository.findAllByActiveTrueOrderBySortOrderAscIdAsc().mapNotNull { it.weeklyTargetMinutes }
        return StatsSummaryResponse(
            from = from,
            to = to,
            days = days,
            totalSeconds = total,
            focusSeconds = focus,
            manualSeconds = manual,
            distractionSeconds = distraction,
            dailyAverageSeconds = total / days,
            distractionRatio = if (focus + distraction == 0L) 0.0 else distraction.toDouble() / (focus + distraction),
            studyDays = slices.study().map { it.date }.toSet().size,
            streakDays = streak(to),
            targetSeconds = weeklyTargets.takeIf { it.isNotEmpty() }?.let { it.sum() * 60L * days / 7 },
        )
    }

    /** to부터 거꾸로 공부한 날이 이어진 수. to에 공부가 없으면 전날부터 센다(오늘 아직 시작 전일 수 있으므로). */
    private fun streak(to: LocalDate): Int {
        val studied = collector.collect(to.minusDays(STREAK_LOOKBACK_DAYS), to, now()).study()
            .filter { it.seconds > 0 }.map { it.date }.toSet()
        var day = if (to in studied) to else to.minusDays(1)
        var count = 0
        while (day in studied) {
            count++
            day = day.minusDays(1)
        }
        return count
    }

    /** 활성 분류는 0이어도 모두, 비활성·미분류는 시간이 있을 때만. 시간 많은 순 */
    fun byCategory(from: LocalDate, to: LocalDate): List<CategoryStat> {
        val study = slices(from, to).study()
        val total = study.sumOf { it.seconds }
        val days = days(from, to)
        val secondsById = study.groupBy { it.category?.id }.mapValues { (_, v) -> v.sumOf { it.seconds } }
        val categories = (categoryRepository.findAllByActiveTrueOrderBySortOrderAscIdAsc() + study.mapNotNull { it.category })
            .distinctBy { it.id }

        val stats = categories.map { c ->
            val seconds = secondsById[c.id] ?: 0
            CategoryStat(
                category = CategoryRef.from(c),
                seconds = seconds,
                ratio = if (total == 0L) 0.0 else seconds.toDouble() / total,
                targetRatio = c.targetRatio,
                targetSeconds = c.weeklyTargetMinutes?.let { it * 60L * days / 7 },
            )
        }.toMutableList()
        secondsById[null]?.let { stats += CategoryStat(null, it, it.toDouble() / total, null, null) }
        return stats.sortedByDescending { it.seconds }
    }

    fun timeseries(from: LocalDate, to: LocalDate, unit: StatsUnit): TimeseriesResponse {
        val study = slices(from, to).study()
        val bucketOf = { d: LocalDate ->
            when (unit) {
                StatsUnit.DAY -> d
                StatsUnit.WEEK -> d.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                StatsUnit.MONTH -> d.withDayOfMonth(1)
            }
        }
        val starts = generateSequence(bucketOf(from)) {
            when (unit) {
                StatsUnit.DAY -> it.plusDays(1)
                StatsUnit.WEEK -> it.plusWeeks(1)
                StatsUnit.MONTH -> it.plusMonths(1)
            }
        }.takeWhile { !it.isAfter(to) }.toList()
        val grouped = study.groupBy { bucketOf(it.date) }

        val buckets = starts.map { start ->
            val inBucket = grouped[start].orEmpty()
            SeriesBucket(
                start = start,
                totalSeconds = inBucket.sumOf { it.seconds },
                byCategory = inBucket.groupBy { it.category?.id }
                    .map { (id, v) -> SeriesValue(id, v.sumOf { it.seconds }) }
                    .sortedBy { it.categoryId ?: Long.MAX_VALUE },
            )
        }
        val categories = study.mapNotNull { it.category }.distinctBy { it.id }
            .sortedWith(compareBy({ it.sortOrder }, { it.id })).map(CategoryRef::from)
        return TimeseriesResponse(unit, categories, buckets)
    }

    /** 요일 × 시간대 집중 분포. 수동 기록은 시간대가 없어 빠진다. */
    fun heatmap(from: LocalDate, to: LocalDate): HeatmapResponse {
        val cells = slices(from, to).filter { it.kind == SliceKind.FOCUS }
            .groupBy { it.date.dayOfWeek.value to it.hour!! }
            .map { (key, v) -> HeatmapCell(key.first, key.second, v.sumOf { it.seconds }) }
            .sortedWith(compareBy({ it.dayOfWeek }, { it.hour }))
        return HeatmapResponse(cells, cells.maxOfOrNull { it.seconds } ?: 0)
    }
}
