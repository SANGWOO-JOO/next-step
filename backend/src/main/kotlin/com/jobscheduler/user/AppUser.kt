package com.jobscheduler.user

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.OffsetDateTime

/** 구글로 로그인한 사용자(docs/design.md 11-2). sub로 같은 사람을 알아본다 */
@Entity
@Table(name = "app_user")
class AppUser(
    @Column(updatable = false)
    val googleSub: String,
    var email: String,
    var name: String?,
    var pictureUrl: String?,
    /** 시작 설정을 마쳤는지(2-3) */
    var onboarded: Boolean = false,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null

    @Column(updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
}
