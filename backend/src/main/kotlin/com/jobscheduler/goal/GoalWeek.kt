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
import java.time.LocalDate
import org.hibernate.annotations.TenantId

/** 목표의 한 주 목표 시간(분). 주는 월요일 시작 */
@Entity
@Table(name = "goal_week")
class GoalWeek(
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "goal_id")
    val goal: Goal,
    val weekStart: LocalDate,
    var minutes: Int,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null

    @TenantId
    @Column(name = "user_id", updatable = false)
    var userId: Long? = null
}
