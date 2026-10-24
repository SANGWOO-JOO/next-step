package com.jobscheduler.goal

import org.springframework.data.jpa.repository.EntityGraph
import org.springframework.data.jpa.repository.JpaRepository

interface GoalRepository : JpaRepository<Goal, Long> {
    @EntityGraph(attributePaths = ["category"])
    fun findAllByOrderByIdAsc(): List<Goal>

    fun countByStatus(status: GoalStatus): Long
    fun existsByCategoryId(categoryId: Long): Boolean
    fun existsByTitleAndIdNot(title: String, id: Long): Boolean
    fun findAllByCategoryIdAndStatus(categoryId: Long, status: GoalStatus): List<Goal>
}
