package com.jobscheduler.review

import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.record.DailyLogRepository
import com.jobscheduler.record.DailyLogService
import com.jobscheduler.review.dto.DayStats
import com.jobscheduler.review.dto.MonthlyReviewBrief
import com.jobscheduler.review.dto.MonthlyReviewRequest
import com.jobscheduler.review.dto.MonthlyReviewResponse
import com.jobscheduler.review.dto.WeekStats
import com.jobscheduler.review.dto.WeeklyJournalBrief
import com.jobscheduler.review.dto.WeeklyJournalRequest
import com.jobscheduler.review.dto.WeeklyJournalResponse
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth
import java.time.temporal.TemporalAdjusters

@Service
@Transactional
class ReviewService(
    private val journalRepository: WeeklyJournalRepository,
    private val reviewRepository: MonthlyReviewRepository,
    private val dailyLogService: DailyLogService,
    private val dailyLogRepository: DailyLogRepository,
) {
    @Transactional(readOnly = true)
    fun getJournal(weekStart: LocalDate): WeeklyJournalResponse {
        requireMonday(weekStart)
        return toResponse(weekStart, journalRepository.findByWeekStart(weekStart))
    }

    /** from~to(월요일)의 저장된 주간 일지(최대 1년) */
    @Transactional(readOnly = true)
    fun listJournals(from: LocalDate, to: LocalDate): List<WeeklyJournalBrief> {
        if (to.isBefore(from) || from.plusYears(1).isBefore(to)) {
            throw BusinessRuleException("조회 기간은 1년 이내여야 해요.", "INVALID_RANGE")
        }
        return journalRepository.findAllByWeekStartBetweenOrderByWeekStartAsc(from, to)
            .map { WeeklyJournalBrief(it.weekStart, it.good, it.bad, it.nextAction, it.updatedAt) }
    }

    /** 주당 1개라 없으면 만들고 있으면 고친다. */
    fun saveJournal(weekStart: LocalDate, req: WeeklyJournalRequest): WeeklyJournalResponse {
        requireMonday(weekStart)
        val journal = journalRepository.findByWeekStart(weekStart) ?: journalRepository.save(WeeklyJournal(weekStart))
        journal.good = clean(req.good)
        journal.bad = clean(req.bad)
        journal.nextAction = clean(req.nextAction)
        return toResponse(weekStart, journal)
    }

    @Transactional(readOnly = true)
    fun getReview(month: YearMonth): MonthlyReviewResponse = toResponse(month, reviewRepository.findByMonthStart(month.atDay(1)))

    /** from~to 달의 저장된 월간 회고(최대 36개월) */
    @Transactional(readOnly = true)
    fun listReviews(from: YearMonth, to: YearMonth): List<MonthlyReviewBrief> {
        if (to.isBefore(from) || from.plusMonths(36).isBefore(to)) {
            throw BusinessRuleException("조회 기간은 36개월 이내여야 해요.", "INVALID_RANGE")
        }
        return reviewRepository.findAllByMonthStartBetweenOrderByMonthStartAsc(from.atDay(1), to.atDay(1))
            .map { MonthlyReviewBrief(YearMonth.from(it.monthStart), it.review, it.nextDirection, it.aiSummary, it.updatedAt) }
    }

    fun saveReview(month: YearMonth, req: MonthlyReviewRequest): MonthlyReviewResponse {
        val review = reviewRepository.findByMonthStart(month.atDay(1)) ?: reviewRepository.save(MonthlyReview(month.atDay(1)))
        review.review = clean(req.review)
        review.nextDirection = clean(req.nextDirection)
        return toResponse(month, review)
    }

    /** 그 달에 속한 주(목요일이 그 달에 있는 주)의 월요일 */
    fun mondaysOf(month: YearMonth): List<LocalDate> {
        var monday = month.atDay(1).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
        if (isoMonthOf(monday) != month) monday = monday.plusWeeks(1)
        return generateSequence(monday) { it.plusWeeks(1) }.takeWhile { isoMonthOf(it) == month }.toList()
    }

    /** 월에 걸친 주는 목요일이 속한 달(ISO)에 속한다 */
    private fun isoMonthOf(weekStart: LocalDate): YearMonth = YearMonth.from(weekStart.plusDays(3))

    private fun days(weekStart: LocalDate): List<DayStats> {
        val dates = (0L..6L).map { weekStart.plusDays(it) }
        val conditions = dates.associateWith { dailyLogRepository.findByDate(it)?.condition }
        return dates.map { DayStats(it, conditions[it], dailyLogService.summary(it)) }
    }

    private fun weekStats(weekStart: LocalDate, days: List<DayStats>, journalWritten: Boolean): WeekStats {
        return WeekStats(
            weekStart = weekStart,
            studySeconds = days.sumOf { it.summary.studySeconds },
            focusSeconds = days.sumOf { it.summary.focusSeconds },
            manualMinutes = days.sumOf { it.summary.manualMinutes },
            distractionSeconds = days.sumOf { it.summary.distractionSeconds },
            goalsDone = days.sumOf { it.summary.goalsDone },
            goalsTotal = days.sumOf { it.summary.goalsTotal },
            journalWritten = journalWritten,
        )
    }

    private fun toResponse(weekStart: LocalDate, journal: WeeklyJournal?): WeeklyJournalResponse {
        val days = days(weekStart)
        return WeeklyJournalResponse(
            weekStart = weekStart,
            saved = journal != null,
            good = journal?.good,
            bad = journal?.bad,
            nextAction = journal?.nextAction,
            aiSummary = journal?.aiSummary,
            updatedAt = journal?.updatedAt,
            days = days,
            total = weekStats(weekStart, days, journal != null),
        )
    }

    private fun toResponse(month: YearMonth, review: MonthlyReview?): MonthlyReviewResponse {
        val mondays = mondaysOf(month)
        val written = journalRepository.findAllByWeekStartIn(mondays).map { it.weekStart }.toSet()
        return MonthlyReviewResponse(
            month = month,
            saved = review != null,
            review = review?.review,
            nextDirection = review?.nextDirection,
            aiSummary = review?.aiSummary,
            updatedAt = review?.updatedAt,
            weeks = mondays.map { weekStats(it, days(it), it in written) },
        )
    }

    private fun requireMonday(weekStart: LocalDate) {
        if (weekStart.dayOfWeek != DayOfWeek.MONDAY) {
            throw BusinessRuleException("주 시작일은 월요일이어야 해요: $weekStart", "WEEK_START_NOT_MONDAY")
        }
    }

    private fun clean(text: String?) = text?.trim()?.ifEmpty { null }
}
