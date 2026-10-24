package com.jobscheduler.user

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 회원 탈퇴(docs/design.md 11-6 2-4 ④). 그 사용자의 모든 기록과 계정을 바로 지운다.
 * 참조 순서대로(자식 먼저) user_id로 지운다. 테넌트 필터가 아니라 user_id 조건으로 직접 지워 빠짐이 없게 한다.
 */
@Service
class WithdrawalService(private val jdbcTemplate: JdbcTemplate) {
    companion object {
        /** user_id가 있는 모든 테이블, 지우는 순서 */
        val USER_TABLES = listOf(
            "interruption", "distraction_note", "focus_session", "actual_log", "time_block", "daily_goal", "goal",
            "manual_study_log", "daily_log", "weekly_journal", "monthly_review", "category",
        )
    }

    @Transactional
    fun withdraw(userId: Long) {
        USER_TABLES.forEach { jdbcTemplate.update("DELETE FROM $it WHERE user_id = ?", userId) }
        jdbcTemplate.update("DELETE FROM app_user WHERE id = ?", userId)
    }
}
