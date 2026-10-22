package com.jobscheduler.checklist

import com.jobscheduler.category.Category
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.OffsetDateTime

@Entity
@Table(name = "checklist_item")
class ChecklistItem(
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id")
    var category: Category,
    var content: String,
    var sortOrder: Int,
    var done: Boolean = false,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null

    @Column(updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
}
