package com.jobscheduler.category

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.OffsetDateTime

@Entity
@Table(name = "category")
class Category(
    var name: String,
    var color: String,
    var sortOrder: Int,
    var targetRatio: Int? = null,
    var weeklyTargetMinutes: Int? = null,
    var active: Boolean = true,
    /** 시간표 블록 이름 앞 이모지(1-4f ㊻) */
    var icon: String? = null,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null

    @Column(updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
}
