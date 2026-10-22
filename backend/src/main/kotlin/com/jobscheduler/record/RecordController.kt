package com.jobscheduler.record

import com.jobscheduler.record.dto.DailyLogRequest
import com.jobscheduler.record.dto.DailyLogResponse
import com.jobscheduler.record.dto.ManualStudyLogRequest
import com.jobscheduler.record.dto.ManualStudyLogResponse
import jakarta.validation.Valid
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.format.annotation.DateTimeFormat.ISO
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate

@RestController
@RequestMapping("/api/manual-logs")
class ManualStudyLogController(private val manualLogService: ManualStudyLogService) {
    @GetMapping
    fun list(@RequestParam @DateTimeFormat(iso = ISO.DATE) date: LocalDate): List<ManualStudyLogResponse> =
        manualLogService.list(date)

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@Valid @RequestBody req: ManualStudyLogRequest): ManualStudyLogResponse = manualLogService.create(req)

    @PutMapping("/{id}")
    fun update(@PathVariable id: Long, @Valid @RequestBody req: ManualStudyLogRequest): ManualStudyLogResponse =
        manualLogService.update(id, req)

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(@PathVariable id: Long) = manualLogService.delete(id)
}

@RestController
@RequestMapping("/api/daily-logs")
class DailyLogController(private val dailyLogService: DailyLogService) {
    /** 기록 페이지: 기록이나 공부가 있는 날을 최신순으로 (예: ?from=2026-10-01&to=2026-10-31) */
    @GetMapping
    fun list(
        @RequestParam @DateTimeFormat(iso = ISO.DATE) from: LocalDate,
        @RequestParam @DateTimeFormat(iso = ISO.DATE) to: LocalDate,
    ): List<DailyLogResponse> = dailyLogService.list(from, to)

    @GetMapping("/{date}")
    fun get(@PathVariable @DateTimeFormat(iso = ISO.DATE) date: LocalDate): DailyLogResponse = dailyLogService.get(date)

    @PutMapping("/{date}")
    fun save(
        @PathVariable @DateTimeFormat(iso = ISO.DATE) date: LocalDate,
        @Valid @RequestBody req: DailyLogRequest,
    ): DailyLogResponse = dailyLogService.save(date, req)
}
