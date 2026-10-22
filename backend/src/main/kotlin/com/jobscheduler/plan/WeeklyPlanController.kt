package com.jobscheduler.plan

import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.plan.dto.WeeklyPlanCreateRequest
import com.jobscheduler.plan.dto.WeeklyPlanResponse
import com.jobscheduler.plan.dto.WeeklyPlanUpdateRequest
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
@RequestMapping("/api/weekly-plans")
class WeeklyPlanController(private val weeklyPlanService: WeeklyPlanService) {

    /** weekStart의 한 주(월~일), 또는 date 하루의 계획 */
    @GetMapping
    fun list(
        @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) weekStart: LocalDate?,
        @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) date: LocalDate?,
    ): List<WeeklyPlanResponse> = when {
        weekStart != null -> weeklyPlanService.list(weekStart, weekStart.plusDays(6))
        date != null -> weeklyPlanService.list(date, date)
        else -> throw BusinessRuleException("weekStart 또는 date가 필요해요.", "MISSING_FILTER")
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@Valid @RequestBody req: WeeklyPlanCreateRequest): WeeklyPlanResponse = weeklyPlanService.create(req)

    @PutMapping("/{id}")
    fun update(@PathVariable id: Long, @Valid @RequestBody req: WeeklyPlanUpdateRequest): WeeklyPlanResponse =
        weeklyPlanService.update(id, req)

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(@PathVariable id: Long) = weeklyPlanService.delete(id)
}
