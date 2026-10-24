package com.jobscheduler.focus

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
import jakarta.persistence.Table
import java.time.OffsetDateTime
import org.hibernate.annotations.TenantId

/** 딴짓·휴식은 집중 시간에서 빼고, 공부 자료 찾기는 집중으로 친다. */
enum class InterruptionType(val countsAsFocus: Boolean) {
    DISTRACTION(false),
    STUDY_MATERIAL(true),
    BREAK(false),
}

enum class InterruptionDetection { TAB_HIDDEN, BUTTON }

@Entity
@Table(name = "interruption")
class Interruption(
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "focus_session_id")
    val session: FocusSession,
    val startedAt: OffsetDateTime,
    @Enumerated(EnumType.STRING)
    val detection: InterruptionDetection,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null

    /** 주인(docs/design.md 11-6 2-1). Hibernate가 현재 로그인 사용자로 채우고 조회 때 거른다 */
    @TenantId
    @Column(name = "user_id", updatable = false)
    var userId: Long? = null

    var endedAt: OffsetDateTime? = null

    /** 끝낼 때 정한다. 열려 있는 동안은 null */
    @Enumerated(EnumType.STRING)
    @Column(name = "interruption_type")
    var type: InterruptionType? = null

    var memo: String? = null

    @Column(updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
}
