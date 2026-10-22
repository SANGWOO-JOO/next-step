package com.jobscheduler.record

import org.springframework.data.jpa.repository.EntityGraph
import org.springframework.data.jpa.repository.JpaRepository
import java.time.LocalDate

interface ManualStudyLogRepository : JpaRepository<ManualStudyLog, Long> {
    @EntityGraph(attributePaths = ["category"])
    fun findAllByDateOrderByCreatedAtAscIdAsc(date: LocalDate): List<ManualStudyLog>

    @EntityGraph(attributePaths = ["category"])
    fun findAllByDateBetween(from: LocalDate, to: LocalDate): List<ManualStudyLog>
}

interface DailyLogRepository : JpaRepository<DailyLog, Long> {
    fun findByDate(date: LocalDate): DailyLog?
}
