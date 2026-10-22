package com.jobscheduler.plan

import org.springframework.data.jpa.repository.EntityGraph
import org.springframework.data.jpa.repository.JpaRepository
import java.time.LocalDate

interface WeeklyPlanRepository : JpaRepository<WeeklyPlan, Long> {
    @EntityGraph(attributePaths = ["weeklyGoal", "weeklyGoal.category"])
    fun findAllByDateBetween(from: LocalDate, to: LocalDate): List<WeeklyPlan>

    fun countByDate(date: LocalDate): Long
    fun existsByWeeklyGoalId(weeklyGoalId: Long): Boolean
    fun findAllByWeeklyGoalId(weeklyGoalId: Long): List<WeeklyPlan>
}
