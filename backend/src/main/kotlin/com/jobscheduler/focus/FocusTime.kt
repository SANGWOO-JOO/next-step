package com.jobscheduler.focus

import java.time.Duration
import java.time.OffsetDateTime

/** 실제 집중 시간 = 경과 시간 − (딴짓 + 휴식) 중단. 공부 자료 찾기는 집중으로 치고, 아직 종류를 모르는 열린 중단은 뺀다. */
object FocusTime {
    data class Result(val focusSeconds: Long, val pausedSeconds: Long)

    fun calculate(session: FocusSession, now: OffsetDateTime): Result {
        val end = session.endedAt ?: now
        val elapsed = seconds(session.startedAt, end)
        val paused = session.interruptions
            .filter { it.type?.countsAsFocus != true }
            .sumOf { i ->
                val from = maxOf(i.startedAt, session.startedAt)
                val to = minOf(i.endedAt ?: end, end)
                seconds(from, to)
            }
            .coerceAtMost(elapsed)
        return Result(elapsed - paused, paused)
    }

    private fun seconds(from: OffsetDateTime, to: OffsetDateTime) =
        Duration.between(from, to).seconds.coerceAtLeast(0)
}
