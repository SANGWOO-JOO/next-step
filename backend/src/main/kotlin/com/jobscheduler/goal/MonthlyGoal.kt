package com.jobscheduler.goal

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.math.BigDecimal
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.YearMonth

@Entity
@Table(name = "monthly_goal")
class MonthlyGoal(
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "goal_id")
    val goal: Goal,
    /** 해당 월의 1일 */
    var monthStart: LocalDate,
    var content: String,
    var targetValue: BigDecimal? = null,
    var currentValue: BigDecimal? = null,
    var unit: String? = null,
    var achieved: Boolean = false,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null

    @Column(updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()

    val month: YearMonth get() = YearMonth.from(monthStart)
}
