package com.jobscheduler.goal

import org.springframework.data.jpa.repository.EntityGraph
import org.springframework.data.jpa.repository.JpaRepository
import java.time.LocalDate

interface GoalRepository : JpaRepository<Goal, Long> {
    fun findAllByOrderByStartDateAscIdAsc(): List<Goal>
}

interface MonthlyGoalRepository : JpaRepository<MonthlyGoal, Long> {
    fun findAllByGoalIdInOrderByMonthStartAscIdAsc(goalIds: Collection<Long>): List<MonthlyGoal>
    fun findAllByMonthStartOrderByIdAsc(monthStart: LocalDate): List<MonthlyGoal>
    fun existsByGoalId(goalId: Long): Boolean
}

interface WeeklyGoalRepository : JpaRepository<WeeklyGoal, Long> {
    @EntityGraph(attributePaths = ["category"])
    fun findAllByMonthlyGoalIdInOrderByWeekStartAscIdAsc(monthlyGoalIds: Collection<Long>): List<WeeklyGoal>

    @EntityGraph(attributePaths = ["category"])
    fun findAllByWeekStartOrderByIdAsc(weekStart: LocalDate): List<WeeklyGoal>

    fun findAllByMonthlyGoalId(monthlyGoalId: Long): List<WeeklyGoal>
    fun existsByMonthlyGoalId(monthlyGoalId: Long): Boolean
}
