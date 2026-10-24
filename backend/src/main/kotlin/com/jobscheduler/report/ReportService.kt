package com.jobscheduler.report

import com.jobscheduler.actual.ActualKind
import com.jobscheduler.actual.ActualLog
import com.jobscheduler.actual.ActualLogRepository
import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.goal.GoalRepository
import com.jobscheduler.goal.GoalStatus
import com.jobscheduler.review.WeeklyJournalRepository
import com.jobscheduler.stats.StatsService
import com.jobscheduler.timeblock.TimeBlock
import com.jobscheduler.timeblock.TimeBlockRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.DayOfWeek
import java.time.Duration
import java.time.LocalDate
import java.time.temporal.TemporalAdjusters

/**
 * 내 공부 리포트(docs/design.md 11-6 2-8 ⑧): 실제는 실제 기록(할 일, 공부), 계획은 할 일에 묶인 시간표 블록.
 * 목표는 1:1 분류로 묶는다.
 */
@Service
@Transactional(readOnly = true)
class ReportService(
    private val actualLogRepository: ActualLogRepository,
    private val timeBlockRepository: TimeBlockRepository,
    private val goalRepository: GoalRepository,
    private val journalRepository: WeeklyJournalRepository,
    private val statsService: StatsService,
) {
    fun report(period: ReportPeriod, start: LocalDate, today: LocalDate): ReportResponse {
        val (from, to) = range(period, start)
        val (prevFrom, prevTo) = range(period, if (period == ReportPeriod.WEEK) from.minusWeeks(1) else from.minusMonths(1))
        val logs = studyLogs(from, to)
        val blocks = plannedBlocks(from, to)

        val bucketStarts = when (period) {
            ReportPeriod.WEEK -> (0L..6L).map { from.plusDays(it) }
            ReportPeriod.MONTH -> generateSequence(from.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))) { it.plusWeeks(1) }
                .takeWhile { !it.isAfter(to) }.toList()
        }
        val bucketOf = { date: LocalDate -> if (period == ReportPeriod.WEEK) date else date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)) }
        val buckets = bucketStarts.map { b ->
            ReportBucket(b, blocks.filter { bucketOf(it.date) == b }.sumOf(::minutes), logs.filter { bucketOf(it.date) == b }.sumOf(::minutes))
        }

        val goals = goalRepository.findAllByOrderByIdAsc().mapNotNull { g ->
            val categoryId = g.category.id
            val goalLogs = logs.filter { categoryOf(it) == categoryId }
            val planned = blocks.filter { it.dailyGoal?.category?.id == categoryId }.sumOf(::minutes)
            val actual = goalLogs.sumOf(::minutes)
            if (g.status != GoalStatus.ACTIVE && planned + actual == 0) return@mapNotNull null
            val top = goalLogs.filter { !it.title.isNullOrBlank() }.groupBy { it.title!! }
                .mapValues { (_, v) -> v.sumOf(::minutes) }.maxByOrNull { it.value }
            ReportGoal(g.id!!, g.title, g.category.color, g.icon, planned, actual, top?.key, top?.value ?: 0)
        }.sortedByDescending { it.actualMinutes }

        return ReportResponse(
            period = period,
            from = from,
            to = to,
            actualMinutes = logs.sumOf(::minutes),
            plannedMinutes = blocks.sumOf(::minutes),
            previousActualMinutes = studyLogs(prevFrom, prevTo).sumOf(::minutes),
            studyDays = logs.map { it.date }.toSet().size,
            streakDays = statsService.summary(today, today).streakDays,
            buckets = buckets,
            goals = goals,
            lastWeekFeedback = if (period == ReportPeriod.WEEK) journalRepository.findByWeekStart(from.minusWeeks(1))?.aiSummary else null,
        )
    }

    private fun range(period: ReportPeriod, start: LocalDate): Pair<LocalDate, LocalDate> = when (period) {
        ReportPeriod.WEEK -> {
            if (start.dayOfWeek != DayOfWeek.MONDAY) throw BusinessRuleException("주 시작일은 월요일이어야 해요: $start", "WEEK_START_NOT_MONDAY")
            start to start.plusDays(6)
        }
        ReportPeriod.MONTH -> start.withDayOfMonth(1) to start.withDayOfMonth(1).plusMonths(1).minusDays(1)
    }

    private fun studyLogs(from: LocalDate, to: LocalDate) =
        actualLogRepository.findAllByDateBetween(from, to).filter { it.kind == ActualKind.GOAL || it.kind == ActualKind.STUDY }

    private fun plannedBlocks(from: LocalDate, to: LocalDate) = timeBlockRepository.findAllByDateBetween(from, to).filter { it.dailyGoal != null }

    private fun categoryOf(log: ActualLog) = (log.dailyGoal?.category ?: log.category)?.id

    private fun minutes(log: ActualLog) = Duration.between(log.startAt, log.endAt).toMinutes().toInt().coerceAtLeast(0)

    private fun minutes(block: TimeBlock) = Duration.between(block.startAt, block.endAt).toMinutes().toInt().coerceAtLeast(0)
}
