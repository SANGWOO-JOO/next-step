package com.jobscheduler.goal

import com.jobscheduler.common.BusinessRuleException
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth

/** 목표 구조의 기간 규칙. 주는 월요일 시작이고, 월에 걸친 주는 목요일이 속한 달(ISO)에 속한다. */
object GoalRules {

    fun isoMonthOf(weekStart: LocalDate): YearMonth = YearMonth.from(weekStart.plusDays(3))

    fun requirePeriod(startDate: LocalDate, targetDate: LocalDate) {
        if (targetDate.isBefore(startDate)) {
            throw BusinessRuleException("목표일은 시작일보다 빠를 수 없어요.", "INVALID_PERIOD")
        }
    }

    /** 월간 목표의 달이 최종 목표 기간과 겹쳐야 한다. */
    fun requireMonthInPeriod(month: YearMonth, startDate: LocalDate, targetDate: LocalDate) {
        if (month.atEndOfMonth().isBefore(startDate) || month.atDay(1).isAfter(targetDate)) {
            throw BusinessRuleException(
                "$month 은(는) 최종 목표 기간($startDate ~ $targetDate) 밖이에요.",
                "MONTH_OUT_OF_GOAL_PERIOD",
            )
        }
    }

    /** 주 시작일은 월요일이고, 그 주가 월간 목표의 달에 속해야 한다. */
    fun requireWeekInMonth(weekStart: LocalDate, month: YearMonth) {
        if (weekStart.dayOfWeek != DayOfWeek.MONDAY) {
            throw BusinessRuleException("주 시작일은 월요일이어야 해요: $weekStart", "WEEK_START_NOT_MONDAY")
        }
        val weekMonth = isoMonthOf(weekStart)
        if (weekMonth != month) {
            throw BusinessRuleException(
                "$weekStart 주는 $weekMonth 에 속해서 $month 월간 목표에 연결할 수 없어요.",
                "WEEK_NOT_IN_MONTH",
            )
        }
    }
}
