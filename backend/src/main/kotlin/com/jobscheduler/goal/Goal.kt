package com.jobscheduler.goal

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.PreUpdate
import jakarta.persistence.Table
import java.time.LocalDate
import java.time.OffsetDateTime

enum class GoalStatus { ACTIVE, DONE, DROPPED }

@Entity
@Table(name = "goal")
class Goal(
    var title: String,
    var description: String?,
    var startDate: LocalDate,
    var targetDate: LocalDate,
    @Enumerated(EnumType.STRING)
    var status: GoalStatus = GoalStatus.ACTIVE,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null

    @Column(updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()

    var updatedAt: OffsetDateTime = OffsetDateTime.now()

    @PreUpdate
    fun touch() {
        updatedAt = OffsetDateTime.now()
    }
}
