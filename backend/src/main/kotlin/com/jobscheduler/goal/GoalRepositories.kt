package com.jobscheduler.goal

import org.springframework.data.jpa.repository.EntityGraph
import org.springframework.data.jpa.repository.JpaRepository
import java.time.LocalDate

interface GoalRepository : JpaRepository<Goal, Long> {
    @EntityGraph(attributePaths = ["category"])
    fun findAllByOrderByIdAsc(): List<Goal>

    fun countByStatus(status: GoalStatus): Long
    fun findAllByCategoryIdAndStatus(categoryId: Long, status: GoalStatus): List<Goal>
}

interface GoalWeekRepository : JpaRepository<GoalWeek, Long> {
    fun findAllByWeekStart(weekStart: LocalDate): List<GoalWeek>
    fun findByGoalIdAndWeekStart(goalId: Long, weekStart: LocalDate): GoalWeek?
    fun deleteAllByGoalId(goalId: Long)
}
