package com.jobscheduler.timeblock

import com.jobscheduler.daily.DailyGoal
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
import org.hibernate.annotations.TenantId

@Entity
@Table(name = "time_block")
class TimeBlock(
    /** 없으면 목표가 아닌 일정(밥 먹기, 산책 등)이고 title을 쓴다 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "daily_goal_id")
    var dailyGoal: DailyGoal?,
    var title: String?,
    /** 시작 시각의 서울 기준 날짜 */
    @Column(name = "block_date")
    var date: LocalDate,
    var startAt: OffsetDateTime,
    var endAt: OffsetDateTime,
    /** 직접 고른 색(#RRGGBB). 없으면 분류 색 */
    var color: String? = null,
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

    /** 화면에 보여줄 이름: 하루 목표 내용 또는 제목 */
    val label: String get() = dailyGoal?.content ?: title.orEmpty()
}
