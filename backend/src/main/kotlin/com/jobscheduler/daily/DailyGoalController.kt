package com.jobscheduler.daily

import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.daily.dto.DailyGoalCreateRequest
import com.jobscheduler.daily.dto.DailyGoalMoveRequest
import com.jobscheduler.daily.dto.DailyGoalMoveResponse
import com.jobscheduler.daily.dto.DailyGoalOrderRequest
import com.jobscheduler.daily.dto.DailyGoalResponse
import com.jobscheduler.daily.dto.DailyGoalTypeRequest
import com.jobscheduler.daily.dto.DailyGoalUpdateRequest
import jakarta.validation.Valid
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.format.annotation.DateTimeFormat.ISO
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
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
@RequestMapping("/api/daily-goals")
class DailyGoalController(private val dailyGoalService: DailyGoalService) {

    /** date 하루, 또는 from~to 기간(최대 62일)의 하루 목표 */
    @GetMapping
    fun list(
        @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) date: LocalDate?,
        @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) from: LocalDate?,
        @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) to: LocalDate?,
    ): List<DailyGoalResponse> {
        val start = date ?: from ?: throw BusinessRuleException("date 또는 from·to가 필요해요.", "MISSING_FILTER")
        return dailyGoalService.list(start, date ?: to ?: start)
    }

    /** before 이전 날짜의 미완료 목표 */
    @GetMapping("/unfinished")
    fun unfinished(@RequestParam @DateTimeFormat(iso = ISO.DATE) before: LocalDate): List<DailyGoalResponse> =
        dailyGoalService.unfinished(before)

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@Valid @RequestBody req: DailyGoalCreateRequest): DailyGoalResponse = dailyGoalService.create(req)

    @PutMapping("/{id}")
    fun update(@PathVariable id: Long, @Valid @RequestBody req: DailyGoalUpdateRequest): DailyGoalResponse =
        dailyGoalService.update(id, req)

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(@PathVariable id: Long) = dailyGoalService.delete(id)

    @PostMapping("/{id}/move")
    fun move(@PathVariable id: Long, @RequestBody req: DailyGoalMoveRequest): DailyGoalMoveResponse =
        dailyGoalService.move(id, req.date, req.weeklyGoalId)

    @PatchMapping("/{id}/type")
    fun changeType(@PathVariable id: Long, @RequestBody req: DailyGoalTypeRequest): DailyGoalResponse =
        dailyGoalService.changeType(id, req.type)

    @PutMapping("/order")
    fun reorder(@Valid @RequestBody req: DailyGoalOrderRequest): List<DailyGoalResponse> =
        dailyGoalService.reorder(req.date, req.type, req.ids)
}
