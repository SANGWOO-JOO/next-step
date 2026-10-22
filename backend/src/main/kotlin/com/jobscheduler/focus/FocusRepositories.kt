package com.jobscheduler.focus

import org.springframework.data.jpa.repository.EntityGraph
import org.springframework.data.jpa.repository.JpaRepository
import java.time.LocalDate

interface FocusSessionRepository : JpaRepository<FocusSession, Long> {
    @EntityGraph(attributePaths = ["dailyGoal", "category"])
    fun findFirstByEndedAtIsNullOrderByStartedAtDesc(): FocusSession?

    @EntityGraph(attributePaths = ["dailyGoal", "category"])
    fun findAllByDateOrderByStartedAtAsc(date: LocalDate): List<FocusSession>

    fun findAllByDailyGoalId(dailyGoalId: Long): List<FocusSession>
}

interface DistractionNoteRepository : JpaRepository<DistractionNote, Long> {
    @EntityGraph(attributePaths = ["session", "session.dailyGoal"])
    fun findAllByCheckedOrderByCreatedAtDesc(checked: Boolean): List<DistractionNote>

    @EntityGraph(attributePaths = ["session", "session.dailyGoal"])
    fun findAllByOrderByCreatedAtDesc(): List<DistractionNote>

    fun findAllBySessionIdOrderByCreatedAtAsc(sessionId: Long): List<DistractionNote>

    fun countByChecked(checked: Boolean): Long
}
