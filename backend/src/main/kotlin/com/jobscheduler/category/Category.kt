package com.jobscheduler.category

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.OffsetDateTime
import org.hibernate.annotations.TenantId

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

    /** 주인(docs/design.md 11-6 2-1). Hibernate가 현재 로그인 사용자로 채우고 조회 때 거른다 */
    @TenantId
    @Column(name = "user_id", updatable = false)
    var userId: Long? = null

    @Column(updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
}
