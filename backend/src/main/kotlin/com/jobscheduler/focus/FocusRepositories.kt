package com.jobscheduler.focus

import org.springframework.data.jpa.repository.EntityGraph
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.LocalDate
import java.time.OffsetDateTime

interface FocusSessionRepository : JpaRepository<FocusSession, Long> {
    @EntityGraph(attributePaths = ["dailyGoal", "category"])
    fun findFirstByEndedAtIsNullOrderByStartedAtDesc(): FocusSession?

    @EntityGraph(attributePaths = ["dailyGoal", "category"])
    fun findAllByDateOrderByStartedAtAsc(date: LocalDate): List<FocusSession>

    fun findAllByDailyGoalId(dailyGoalId: Long): List<FocusSession>

    /** [from, to) 와 겹치는 세션 (진행 중 포함). 집계용이라 분류 결정에 필요한 연관을 함께 읽는다. */
    @EntityGraph(
        attributePaths = ["category", "dailyGoal", "dailyGoal.category", "dailyGoal.goal", "dailyGoal.goal.category"],
    )
    @Query("select s from FocusSession s where s.startedAt < :to and (s.endedAt is null or s.endedAt > :from)")
    fun findOverlapping(@Param("from") from: OffsetDateTime, @Param("to") to: OffsetDateTime): List<FocusSession>
}

interface DistractionNoteRepository : JpaRepository<DistractionNote, Long> {
    @EntityGraph(attributePaths = ["session", "session.dailyGoal"])
    fun findAllByCheckedOrderByCreatedAtDesc(checked: Boolean): List<DistractionNote>

    @EntityGraph(attributePaths = ["session", "session.dailyGoal"])
    fun findAllByOrderByCreatedAtDesc(): List<DistractionNote>

    fun findAllBySessionIdOrderByCreatedAtAsc(sessionId: Long): List<DistractionNote>

    fun countByChecked(checked: Boolean): Long
}
