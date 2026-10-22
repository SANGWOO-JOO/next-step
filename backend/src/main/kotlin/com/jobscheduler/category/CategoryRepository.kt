package com.jobscheduler.category

import org.springframework.data.jpa.repository.JpaRepository

interface CategoryRepository : JpaRepository<Category, Long> {
    fun findAllByOrderBySortOrderAscIdAsc(): List<Category>
    fun findAllByActiveTrueOrderBySortOrderAscIdAsc(): List<Category>
    fun existsByName(name: String): Boolean
    fun existsByNameAndIdNot(name: String, id: Long): Boolean
}
