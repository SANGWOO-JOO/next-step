package com.jobscheduler.actual

import org.springframework.data.jpa.repository.EntityGraph
import org.springframework.data.jpa.repository.JpaRepository
import java.time.LocalDate

interface ActualLogRepository : JpaRepository<ActualLog, Long> {
    @EntityGraph(attributePaths = ["dailyGoal", "category"])
    fun findAllByDateBetween(from: LocalDate, to: LocalDate): List<ActualLog>

    @EntityGraph(attributePaths = ["dailyGoal", "category"])
    fun findAllByDate(date: LocalDate): List<ActualLog>

    fun findAllByDailyGoalId(dailyGoalId: Long): List<ActualLog>

    fun findAllByKindOrderByStartAtDesc(kind: ActualKind): List<ActualLog>
}
