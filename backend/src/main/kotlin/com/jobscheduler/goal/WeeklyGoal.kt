package com.jobscheduler.goal

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
import java.time.LocalDate
import java.time.OffsetDateTime
import org.hibernate.annotations.TenantId

@Entity
@Table(name = "weekly_goal")
class WeeklyGoal(
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "monthly_goal_id")
    val monthlyGoal: MonthlyGoal,
    /** 해당 주의 월요일 */
    var weekStart: LocalDate,
    var content: String,
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    var category: Category? = null,
    var achieved: Boolean = false,
    /** 다음 주로 이어갔는지 */
    var carriedOver: Boolean = false,
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
}
