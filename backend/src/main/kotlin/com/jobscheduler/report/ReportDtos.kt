package com.jobscheduler.report

import java.time.LocalDate

enum class ReportPeriod { WEEK, MONTH }

/** 요일(주) 또는 주(달) 한 칸의 계획과 실제(분) */
data class ReportBucket(val start: LocalDate, val plannedMinutes: Int, val actualMinutes: Int)

data class ReportGoal(
    val id: Long,
    val title: String,
    val color: String,
    val icon: String?,
    val plannedMinutes: Int,
    val actualMinutes: Int,
    /** 많이 한 세부 내용 1개 */
    val topDetail: String?,
    val topDetailMinutes: Int,
)

/** 내 공부 리포트(docs/design.md 11-6 2-8) */
data class ReportResponse(
    val period: ReportPeriod,
    val from: LocalDate,
    val to: LocalDate,
    val actualMinutes: Int,
    val plannedMinutes: Int,
    /** 바로 앞 기간의 실제 */
    val previousActualMinutes: Int,
    val studyDays: Int,
    val streakDays: Int,
    val buckets: List<ReportBucket>,
    val goals: List<ReportGoal>,
    /** 이번 주 보기일 때 지난 주 AI 피드백(JSON). 없으면 null */
    val lastWeekFeedback: String?,
)
