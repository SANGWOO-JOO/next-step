package com.jobscheduler.report

import com.jobscheduler.JobSchedulerApplication
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.format.annotation.DateTimeFormat.ISO
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.Clock
import java.time.LocalDate
import java.time.ZoneId

@RestController
@RequestMapping("/api/report")
class ReportController(private val reportService: ReportService, private val clock: Clock) {
    /** 내 공부 리포트(2-8). WEEK는 월요일, MONTH는 그 달의 아무 날 */
    @GetMapping
    fun report(@RequestParam period: ReportPeriod, @RequestParam @DateTimeFormat(iso = ISO.DATE) start: LocalDate): ReportResponse =
        reportService.report(period, start, LocalDate.now(clock.withZone(ZoneId.of(JobSchedulerApplication.APP_ZONE))))
}
