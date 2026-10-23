package com.jobscheduler.actual

import com.jobscheduler.actual.dto.ActualLogRequest
import com.jobscheduler.actual.dto.ActualLogResponse
import com.jobscheduler.common.BusinessRuleException
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
@RequestMapping("/api/actual-logs")
class ActualLogController(private val actualLogService: ActualLogService) {

    /** date 하루, 또는 from~to 기간의 실제 기록 */
    @GetMapping
    fun list(
        @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) date: LocalDate?,
        @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) from: LocalDate?,
        @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) to: LocalDate?,
    ): List<ActualLogResponse> {
        val start = date ?: from ?: throw BusinessRuleException("date 또는 from·to가 필요해요.", "MISSING_FILTER")
        return actualLogService.list(start, date ?: to ?: start)
    }

    /** 만들고 나면 그날 기록 전체(잘리고 합쳐진 결과)를 돌려준다 */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@Valid @RequestBody req: ActualLogRequest): List<ActualLogResponse> = actualLogService.create(req)

    @PutMapping("/{id}")
    fun update(@PathVariable id: Long, @Valid @RequestBody req: ActualLogRequest): List<ActualLogResponse> =
        actualLogService.update(id, req)

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(@PathVariable id: Long) = actualLogService.delete(id)

    /** [계획대로]: 계획 블록을 실제 기록으로 */
    @PostMapping("/from-block/{blockId}")
    @ResponseStatus(HttpStatus.CREATED)
    fun fromBlock(@PathVariable blockId: Long): List<ActualLogResponse> = actualLogService.fromBlock(blockId)

    /** 딴짓 제목 자동완성 */
    @GetMapping("/distraction-titles")
    fun distractionTitles(@RequestParam(required = false) q: String?): List<String> = actualLogService.distractionTitles(q)
}
