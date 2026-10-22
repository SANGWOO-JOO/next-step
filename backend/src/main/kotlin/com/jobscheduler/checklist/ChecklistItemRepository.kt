package com.jobscheduler.checklist

import org.springframework.data.jpa.repository.EntityGraph
import org.springframework.data.jpa.repository.JpaRepository

interface ChecklistItemRepository : JpaRepository<ChecklistItem, Long> {
    @EntityGraph(attributePaths = ["category"])
    override fun findAll(): List<ChecklistItem>

    @EntityGraph(attributePaths = ["category"])
    fun findAllByCategoryId(categoryId: Long): List<ChecklistItem>

    fun countByCategoryId(categoryId: Long): Long
}
