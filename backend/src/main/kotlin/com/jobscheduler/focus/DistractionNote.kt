package com.jobscheduler.focus

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.OffsetDateTime
import org.hibernate.annotations.TenantId

@Entity
@Table(name = "distraction_note")
class DistractionNote(
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "focus_session_id")
    val session: FocusSession,
    val content: String,
    var checked: Boolean = false,
    @Column(updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now(),
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null

    /** 주인(docs/design.md 11-6 2-1). Hibernate가 현재 로그인 사용자로 채우고 조회 때 거른다 */
    @TenantId
    @Column(name = "user_id", updatable = false)
    var userId: Long? = null
}
