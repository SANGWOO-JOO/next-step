package com.jobscheduler.daily

import com.jobscheduler.category.Category
import com.jobscheduler.goal.WeeklyGoal
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.PreUpdate
import jakarta.persistence.Table
import java.time.LocalDate
import java.time.OffsetDateTime

enum class DailyGoalType { CORE, EXTRA }

enum class DailyGoalStatus { TODO, DONE }

@Entity
@Table(name = "daily_goal")
class DailyGoal(
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "weekly_goal_id")
    var weeklyGoal: WeeklyGoal,
    @Column(name = "goal_date")
    var date: LocalDate,
    var content: String,
    var firstAction: String? = null,
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    var category: Category? = null,
    @Enumerated(EnumType.STRING)
    @Column(name = "goal_type")
    var type: DailyGoalType,
    var sortOrder: Int,
    @Enumerated(EnumType.STRING)
    var status: DailyGoalStatus = DailyGoalStatus.TODO,
    var carryCount: Int = 0,
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
