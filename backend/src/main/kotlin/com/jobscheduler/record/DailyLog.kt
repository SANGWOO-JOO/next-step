package com.jobscheduler.record

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

/** 하루 기록. 날짜당 1개. 집중·딴짓 시간은 저장하지 않고 조회할 때 계산한다. */
@Entity
@Table(name = "daily_log")
class DailyLog(
    @Column(name = "log_date")
    val date: LocalDate,
    var memo: String? = null,
    /** 1~5, 선택 */
    @Column(name = "condition_score")
    var condition: Int? = null,
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
