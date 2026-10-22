package com.jobscheduler.review

import org.springframework.data.jpa.repository.JpaRepository
import java.time.LocalDate

interface WeeklyJournalRepository : JpaRepository<WeeklyJournal, Long> {
    fun findByWeekStart(weekStart: LocalDate): WeeklyJournal?
    fun findAllByWeekStartIn(weekStarts: Collection<LocalDate>): List<WeeklyJournal>
}

interface MonthlyReviewRepository : JpaRepository<MonthlyReview, Long> {
    fun findByMonthStart(monthStart: LocalDate): MonthlyReview?
    fun findAllByMonthStartBetweenOrderByMonthStartAsc(from: LocalDate, to: LocalDate): List<MonthlyReview>
}
