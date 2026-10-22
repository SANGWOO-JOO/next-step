package com.jobscheduler.goal

import com.jobscheduler.goal.dto.MonthlyGoalCreateRequest
import com.jobscheduler.goal.dto.MonthlyGoalResponse
import com.jobscheduler.goal.dto.MonthlyGoalUpdateRequest
import jakarta.validation.Valid
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
import java.time.YearMonth

@RestController
@RequestMapping("/api/monthly-goals")
class MonthlyGoalController(private val monthlyGoalService: MonthlyGoalService) {

    /** goalId 또는 month(예: 2026-10) 중 하나는 필요하다. */
    @GetMapping
    fun list(
        @RequestParam(required = false) goalId: Long?,
        @RequestParam(required = false) month: YearMonth?,
    ): List<MonthlyGoalResponse> = monthlyGoalService.list(goalId, month)

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@Valid @RequestBody req: MonthlyGoalCreateRequest): MonthlyGoalResponse =
        monthlyGoalService.create(req)

    @PutMapping("/{id}")
    fun update(@PathVariable id: Long, @Valid @RequestBody req: MonthlyGoalUpdateRequest): MonthlyGoalResponse =
        monthlyGoalService.update(id, req)

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(@PathVariable id: Long) = monthlyGoalService.delete(id)
}
