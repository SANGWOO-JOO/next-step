package com.jobscheduler.plan

import com.jobscheduler.goal.WeeklyGoal
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

/** 주간 목표를 요일별 작업으로 나눈 계획. 요일 대신 그 주의 날짜로 저장한다. */
@Entity
@Table(name = "weekly_plan")
class WeeklyPlan(
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "weekly_goal_id")
    val weeklyGoal: WeeklyGoal,
    @Column(name = "plan_date")
    var date: LocalDate,
    var content: String,
    var sortOrder: Int,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null

    @Column(updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
}
