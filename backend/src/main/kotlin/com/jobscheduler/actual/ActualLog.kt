package com.jobscheduler.actual

import com.jobscheduler.category.Category
import com.jobscheduler.daily.DailyGoal
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
import java.time.LocalDate
import java.time.OffsetDateTime

/** 실제로 한 일의 종류. GOAL·STUDY는 공부 시간, DISTRACTION은 딴짓, OTHER는 밥·산책 같은 일정 */
enum class ActualKind { GOAL, STUDY, DISTRACTION, OTHER }

@Entity
@Table(name = "actual_log")
class ActualLog(
    @Column(name = "log_date")
    var date: LocalDate,
    var startAt: OffsetDateTime,
    var endAt: OffsetDateTime,
    @Enumerated(EnumType.STRING)
    var kind: ActualKind,
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "daily_goal_id")
    var dailyGoal: DailyGoal? = null,
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    var category: Category? = null,
    var title: String? = null,
    /** [계획대로]로 만든 원래 계획 블록 */
    var timeBlockId: Long? = null,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null

    @Column(updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()

    /** 붙어 있으면 하나로 합칠 수 있는 "같은 내용"인지 */
    fun sameContent(other: ActualLog) =
        kind == other.kind && dailyGoal?.id == other.dailyGoal?.id && category?.id == other.category?.id && title == other.title

    /** 자른 나머지 조각을 만들 때 쓰는 복사본 */
    fun copy(startAt: OffsetDateTime, endAt: OffsetDateTime) =
        ActualLog(date, startAt, endAt, kind, dailyGoal, category, title, timeBlockId)

    val label: String
        get() = when (kind) {
            ActualKind.GOAL -> dailyGoal?.content ?: title ?: "하루 목표"
            ActualKind.STUDY -> title ?: category?.name ?: "공부"
            ActualKind.DISTRACTION -> title ?: "딴짓"
            ActualKind.OTHER -> title ?: "기타"
        }
}
