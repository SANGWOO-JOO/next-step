package com.jobscheduler.review

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.PreUpdate
import jakarta.persistence.Table
import java.time.LocalDate
import java.time.OffsetDateTime
import org.hibernate.annotations.TenantId

/** 주간 일지. 주(월요일)당 1개 */
@Entity
@Table(name = "weekly_journal")
class WeeklyJournal(
    val weekStart: LocalDate,
    var good: String? = null,
    var bad: String? = null,
    var nextAction: String? = null,
    /** 2단계 AI가 채운다 */
    var aiSummary: String? = null,
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
