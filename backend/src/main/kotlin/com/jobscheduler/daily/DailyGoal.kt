package com.jobscheduler.daily

import com.jobscheduler.category.Category
import com.jobscheduler.goal.Goal
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
import org.hibernate.annotations.TenantId

enum class DailyGoalType { CORE, EXTRA }

enum class DailyGoalStatus { TODO, DONE }

@Entity
@Table(name = "daily_goal")
class DailyGoal(
    /** 없으면 주간 목표에 연결하지 않은 할 일(1-4f) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "goal_id")
    var goal: Goal?,
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

    /** 주인(docs/design.md 11-6 2-1). Hibernate가 현재 로그인 사용자로 채우고 조회 때 거른다 */
    @TenantId
    @Column(name = "user_id", updatable = false)
    var userId: Long? = null

    @Column(updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()

    var updatedAt: OffsetDateTime = OffsetDateTime.now()

    @PreUpdate
    fun touch() {
        updatedAt = OffsetDateTime.now()
    }
}
