package com.jobscheduler.stats

import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.stats.dto.CategoryStat
import com.jobscheduler.stats.dto.HeatmapResponse
import com.jobscheduler.stats.dto.StatsSummaryResponse
import com.jobscheduler.stats.dto.StatsUnit
import com.jobscheduler.stats.dto.TimeseriesResponse
import com.jobscheduler.stats.dto.TopicCategoryStat
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.format.annotation.DateTimeFormat.ISO
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate

@RestController
@RequestMapping("/api/stats")
class StatsController(private val statsService: StatsService) {
    @GetMapping("/summary")
    fun summary(
        @RequestParam @DateTimeFormat(iso = ISO.DATE) from: LocalDate,
        @RequestParam @DateTimeFormat(iso = ISO.DATE) to: LocalDate,
    ): StatsSummaryResponse = statsService.summary(from, to)

    @GetMapping("/by-topic")
    fun byTopic(
        @RequestParam @DateTimeFormat(iso = ISO.DATE) from: LocalDate,
        @RequestParam @DateTimeFormat(iso = ISO.DATE) to: LocalDate,
    ): List<TopicCategoryStat> = statsService.byTopic(from, to)

    @GetMapping("/by-category")
    fun byCategory(
        @RequestParam @DateTimeFormat(iso = ISO.DATE) from: LocalDate,
        @RequestParam @DateTimeFormat(iso = ISO.DATE) to: LocalDate,
    ): List<CategoryStat> = statsService.byCategory(from, to)

    /** unit: day | week | month */
    @GetMapping("/timeseries")
    fun timeseries(
        @RequestParam @DateTimeFormat(iso = ISO.DATE) from: LocalDate,
        @RequestParam @DateTimeFormat(iso = ISO.DATE) to: LocalDate,
        @RequestParam(defaultValue = "day") unit: String,
    ): TimeseriesResponse {
        val parsed = StatsUnit.entries.firstOrNull { it.name.equals(unit, ignoreCase = true) }
            ?: throw BusinessRuleException("unit은 day, week, month 중 하나여야 해요.", "INVALID_UNIT")
        return statsService.timeseries(from, to, parsed)
    }

    @GetMapping("/heatmap")
    fun heatmap(
        @RequestParam @DateTimeFormat(iso = ISO.DATE) from: LocalDate,
        @RequestParam @DateTimeFormat(iso = ISO.DATE) to: LocalDate,
    ): HeatmapResponse = statsService.heatmap(from, to)
}
