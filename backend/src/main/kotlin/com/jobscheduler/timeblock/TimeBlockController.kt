package com.jobscheduler.timeblock

import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.timeblock.dto.TimeBlockColorRequest
import com.jobscheduler.timeblock.dto.TimeBlockRequest
import com.jobscheduler.timeblock.dto.TimeBlockResponse
import jakarta.validation.Valid
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.format.annotation.DateTimeFormat.ISO
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate

@RestController
@RequestMapping("/api/time-blocks")
class TimeBlockController(private val timeBlockService: TimeBlockService) {

    /** date 하루, 또는 from~to 기간(최대 62일)의 시간 블록 */
    @GetMapping
    fun list(
        @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) date: LocalDate?,
        @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) from: LocalDate?,
        @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) to: LocalDate?,
    ): List<TimeBlockResponse> {
        val start = date ?: from ?: throw BusinessRuleException("date 또는 from·to가 필요해요.", "MISSING_FILTER")
        return timeBlockService.list(start, date ?: to ?: start)
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@Valid @RequestBody req: TimeBlockRequest): TimeBlockResponse = timeBlockService.create(req)

    @PutMapping("/{id}")
    fun update(@PathVariable id: Long, @Valid @RequestBody req: TimeBlockRequest): TimeBlockResponse =
        timeBlockService.update(id, req)

    /** 블록 색 바꾸기(1-4f ㉘). color가 null이면 분류 색으로 */
    @PatchMapping("/{id}/color")
    fun setColor(@PathVariable id: Long, @RequestBody req: TimeBlockColorRequest): TimeBlockResponse =
        timeBlockService.setColor(id, req.color)

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(@PathVariable id: Long) = timeBlockService.delete(id)
}
