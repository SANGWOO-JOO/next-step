package com.jobscheduler.goal

import com.jobscheduler.common.BusinessRuleException
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertDoesNotThrow
import org.junit.jupiter.api.assertThrows
import java.time.LocalDate
import java.time.YearMonth
import kotlin.test.assertEquals

class GoalRulesTest {

    @Test
    fun `월에 걸친 주는 목요일이 속한 달에 속한다`() {
        // 2026-09-28(월) ~ 10-04(일), 목요일은 10-01
        assertEquals(YearMonth.of(2026, 10), GoalRules.isoMonthOf(LocalDate.of(2026, 9, 28)))
        // 2026-11-30(월) ~ 12-06(일), 목요일은 12-03
        assertEquals(YearMonth.of(2026, 12), GoalRules.isoMonthOf(LocalDate.of(2026, 11, 30)))
    }

    @Test
    fun `주 시작일은 월요일이어야 한다`() {
        val e = assertThrows<BusinessRuleException> {
            GoalRules.requireWeekInMonth(LocalDate.of(2026, 10, 21), YearMonth.of(2026, 10))
        }
        assertEquals("WEEK_START_NOT_MONDAY", e.code)
    }

    @Test
    fun `주가 다른 달에 속하면 연결할 수 없다`() {
        val e = assertThrows<BusinessRuleException> {
            GoalRules.requireWeekInMonth(LocalDate.of(2026, 11, 30), YearMonth.of(2026, 11))
        }
        assertEquals("WEEK_NOT_IN_MONTH", e.code)
        assertDoesNotThrow { GoalRules.requireWeekInMonth(LocalDate.of(2026, 9, 28), YearMonth.of(2026, 10)) }
    }

    @Test
    fun `월간 목표의 달은 최종 목표 기간과 겹쳐야 한다`() {
        val start = LocalDate.of(2026, 10, 20)
        val end = LocalDate.of(2027, 3, 31)
        assertDoesNotThrow { GoalRules.requireMonthInPeriod(YearMonth.of(2026, 10), start, end) }
        assertDoesNotThrow { GoalRules.requireMonthInPeriod(YearMonth.of(2027, 3), start, end) }
        val e = assertThrows<BusinessRuleException> {
            GoalRules.requireMonthInPeriod(YearMonth.of(2026, 9), start, end)
        }
        assertEquals("MONTH_OUT_OF_GOAL_PERIOD", e.code)
    }

    @Test
    fun `목표일은 시작일보다 빠를 수 없다`() {
        val e = assertThrows<BusinessRuleException> {
            GoalRules.requirePeriod(LocalDate.of(2026, 10, 20), LocalDate.of(2026, 10, 19))
        }
        assertEquals("INVALID_PERIOD", e.code)
    }
}
