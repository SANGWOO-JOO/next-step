package com.jobscheduler.stats

import com.jobscheduler.JobSchedulerApplication
import com.jobscheduler.actual.ActualKind
import com.jobscheduler.actual.ActualLogRepository
import com.jobscheduler.category.Category
import com.jobscheduler.focus.FocusSession
import com.jobscheduler.focus.FocusSessionRepository
import com.jobscheduler.focus.InterruptionType
import com.jobscheduler.record.ManualStudyLogRepository
import org.springframework.stereotype.Component
import java.time.Duration
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.temporal.ChronoUnit

enum class SliceKind { FOCUS, MANUAL, DISTRACTION }

/** FOCUS는 시간대가 있는 공부(지난 집중 세션 또는 1-4e 실제 기록의 하루 목표·분류 공부) */
/** 집계의 가장 작은 단위. 집중·딴짓은 서울 기준 한 시간 칸 안의 조각이고, 수동 기록은 시간대가 없다. */
data class StudySlice(
    val date: LocalDate,
    /** 0~23. 수동 기록은 null */
    val hour: Int?,
    val category: Category?,
    val seconds: Long,
    val kind: SliceKind,
)

/**
 * 실제 기록·지난 집중 세션·수동 기록을 기간 안의 조각으로 나눈다. 규칙은 docs/design.md 1-4a, 1-4e 참고.
 * 실제 기록이 있는 날은 그날 집중 세션을 빼서 두 번 세지 않는다.
 */
@Component
class StudySliceCollector(
    private val sessionRepository: FocusSessionRepository,
    private val manualLogRepository: ManualStudyLogRepository,
    private val actualLogRepository: ActualLogRepository,
) {
    companion object {
        val ZONE: ZoneId = ZoneId.of(JobSchedulerApplication.APP_ZONE)

        /** 분류 우선순위: 세션 → 하루 목표 → 목표 → 미분류(null) */
        fun categoryOf(s: FocusSession): Category? =
            s.category ?: s.dailyGoal?.category ?: s.dailyGoal?.goal?.category

        /** base에서 holes를 뺀 구간들 */
        fun subtract(base: Interval, holes: List<Interval>): List<Interval> {
            val result = mutableListOf<Interval>()
            var cursor = base.from
            for (h in holes.sortedBy { it.from }) {
                if (!h.to.isAfter(cursor)) continue
                if (!h.from.isBefore(base.to)) break
                if (h.from.isAfter(cursor)) result += Interval(cursor, h.from)
                cursor = maxOf(cursor, h.to)
            }
            if (cursor.isBefore(base.to)) result += Interval(cursor, base.to)
            return result
        }

        /** 구간을 서울 기준 정시 경계로 자른다. (날짜, 시, 초) */
        fun splitByHour(interval: Interval): List<Triple<LocalDate, Int, Long>> {
            val pieces = mutableListOf<Triple<LocalDate, Int, Long>>()
            var cursor = interval.from.atZoneSameInstant(ZONE)
            val end = interval.to.atZoneSameInstant(ZONE)
            while (cursor.isBefore(end)) {
                val next = minOf(cursor.truncatedTo(ChronoUnit.HOURS).plusHours(1), end)
                val seconds = Duration.between(cursor, next).seconds
                if (seconds > 0) pieces += Triple(cursor.toLocalDate(), cursor.hour, seconds)
                cursor = next
            }
            return pieces
        }
    }

    data class Interval(val from: OffsetDateTime, val to: OffsetDateTime)

    fun collect(from: LocalDate, to: LocalDate, now: OffsetDateTime): List<StudySlice> {
        val rangeStart = from.atStartOfDay(ZONE).toOffsetDateTime()
        val rangeEnd = to.plusDays(1).atStartOfDay(ZONE).toOffsetDateTime()
        val slices = mutableListOf<StudySlice>()
        val actuals = actualLogRepository.findAllByDateBetween(from, to)
        val actualDates = actuals.map { it.date }.toSet()

        for (log in actuals) {
            val kind = when (log.kind) {
                ActualKind.GOAL, ActualKind.STUDY -> SliceKind.FOCUS
                ActualKind.DISTRACTION -> SliceKind.DISTRACTION
                ActualKind.OTHER -> continue
            }
            val category = log.category ?: log.dailyGoal?.category ?: log.dailyGoal?.goal?.category
            splitByHour(Interval(log.startAt, log.endAt)).forEach { (date, hour, seconds) ->
                slices += StudySlice(date, hour, category.takeIf { kind == SliceKind.FOCUS }, seconds, kind)
            }
        }

        for (session in sessionRepository.findOverlapping(rangeStart, rangeEnd)) {
            if (session.startedAt.atZoneSameInstant(ZONE).toLocalDate() in actualDates) continue
            val end = minOf(session.endedAt ?: now, rangeEnd)
            val start = maxOf(session.startedAt, rangeStart)
            if (!end.isAfter(start)) continue
            val category = categoryOf(session)
            val interruptions = session.interruptions.map { it to Interval(it.startedAt, it.endedAt ?: session.endedAt ?: now) }

            // 공부 자료 찾기만 집중으로 치고, 딴짓·휴식·종류 미정은 뺀다
            val holes = interruptions.filter { it.first.type?.countsAsFocus != true }.map { it.second }
            subtract(Interval(start, end), holes).flatMap(::splitByHour).forEach { (date, hour, seconds) ->
                slices += StudySlice(date, hour, category, seconds, SliceKind.FOCUS)
            }
            interruptions.filter { it.first.type == InterruptionType.DISTRACTION }.forEach { (_, i) ->
                val clipped = Interval(maxOf(i.from, start), minOf(i.to, end))
                if (clipped.to.isAfter(clipped.from)) {
                    splitByHour(clipped).forEach { (date, hour, seconds) ->
                        slices += StudySlice(date, hour, category, seconds, SliceKind.DISTRACTION)
                    }
                }
            }
        }

        manualLogRepository.findAllByDateBetween(from, to).forEach {
            slices += StudySlice(it.date, null, it.category, it.minutes * 60L, SliceKind.MANUAL)
        }
        return slices
    }
}
