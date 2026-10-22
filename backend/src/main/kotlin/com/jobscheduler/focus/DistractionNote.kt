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
}
