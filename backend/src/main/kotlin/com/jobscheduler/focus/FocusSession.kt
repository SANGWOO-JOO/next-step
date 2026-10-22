package com.jobscheduler.focus

import com.jobscheduler.category.Category
import com.jobscheduler.daily.DailyGoal
import jakarta.persistence.CascadeType
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
import jakarta.persistence.OneToMany
import jakarta.persistence.OrderBy
import jakarta.persistence.Table
import java.time.LocalDate
import java.time.OffsetDateTime

/** 세션을 끝낼 때 고른 결과. 완료 = 하루 목표를 끝냄, 더 하기 = 목표가 남음, 딴짓 = 딴짓으로 흐지부지 */
enum class FocusResult { COMPLETED, MORE, DISTRACTED }

/** 어디서 시작했는지. 텔레그램은 1-5에서 쓴다. */
enum class FocusSource { TODAY, FOCUS_PAGE, TELEGRAM }

@Entity
@Table(name = "focus_session")
class FocusSession(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "daily_goal_id")
    var dailyGoal: DailyGoal?,
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    var category: Category?,
    /** 시작 시각의 서울 기준 날짜 */
    @Column(name = "session_date")
    val date: LocalDate,
    val startedAt: OffsetDateTime,
    val focusMinutes: Int,
    val breakMinutes: Int,
    @Enumerated(EnumType.STRING)
    val source: FocusSource,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null

    var endedAt: OffsetDateTime? = null

    /** 실제 집중 시간(초). 종료할 때 저장한다. */
    var focusSeconds: Long? = null

    @Enumerated(EnumType.STRING)
    var result: FocusResult? = null

    @Column(updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()

    @OneToMany(mappedBy = "session", cascade = [CascadeType.ALL], orphanRemoval = true)
    @OrderBy("startedAt ASC")
    val interruptions: MutableList<Interruption> = mutableListOf()

    val running: Boolean get() = endedAt == null

    val completed: Boolean get() = result == FocusResult.COMPLETED

    val openInterruption: Interruption? get() = interruptions.firstOrNull { it.endedAt == null }
}
