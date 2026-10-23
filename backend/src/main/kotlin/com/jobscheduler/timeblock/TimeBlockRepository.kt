package com.jobscheduler.timeblock

import org.springframework.data.jpa.repository.EntityGraph
import org.springframework.data.jpa.repository.JpaRepository
import java.time.LocalDate

interface TimeBlockRepository : JpaRepository<TimeBlock, Long> {
    @EntityGraph(attributePaths = ["dailyGoal", "dailyGoal.category"])
    fun findAllByDateBetween(from: LocalDate, to: LocalDate): List<TimeBlock>

    fun findAllByDate(date: LocalDate): List<TimeBlock>
    fun findAllByDailyGoalId(dailyGoalId: Long): List<TimeBlock>
    fun findTop100ByDailyGoal_Category_IdAndTitleIsNotNullOrderByIdDesc(categoryId: Long): List<TimeBlock>
}
