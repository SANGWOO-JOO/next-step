package com.jobscheduler.daily

import org.springframework.data.jpa.repository.EntityGraph
import org.springframework.data.jpa.repository.JpaRepository
import java.time.LocalDate

interface DailyGoalRepository : JpaRepository<DailyGoal, Long> {
    @EntityGraph(attributePaths = ["weeklyGoal", "category"])
    fun findAllByDateBetween(from: LocalDate, to: LocalDate): List<DailyGoal>

    @EntityGraph(attributePaths = ["weeklyGoal", "category"])
    fun findAllByDateBeforeAndStatus(date: LocalDate, status: DailyGoalStatus): List<DailyGoal>

    fun findAllByDateAndType(date: LocalDate, type: DailyGoalType): List<DailyGoal>
    fun countByDateAndType(date: LocalDate, type: DailyGoalType): Long
    fun existsByWeeklyGoalId(weeklyGoalId: Long): Boolean
}
