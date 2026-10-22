package com.jobscheduler.goal

import com.jobscheduler.goal.dto.WeeklyGoalCarryRequest
import com.jobscheduler.goal.dto.WeeklyGoalCreateRequest
import com.jobscheduler.goal.dto.WeeklyGoalResponse
import com.jobscheduler.goal.dto.WeeklyGoalUpdateRequest
import jakarta.validation.Valid
import org.springframework.format.annotation.DateTimeFormat
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
@RequestMapping("/api/weekly-goals")
class WeeklyGoalController(private val weeklyGoalService: WeeklyGoalService) {

    /** monthlyGoalId 또는 weekStart(월요일) 중 하나는 필요하다. */
    @GetMapping
    fun list(
        @RequestParam(required = false) monthlyGoalId: Long?,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) weekStart: LocalDate?,
    ): List<WeeklyGoalResponse> = weeklyGoalService.list(monthlyGoalId, weekStart)

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@Valid @RequestBody req: WeeklyGoalCreateRequest): WeeklyGoalResponse =
        weeklyGoalService.create(req)

    @PutMapping("/{id}")
    fun update(@PathVariable id: Long, @Valid @RequestBody req: WeeklyGoalUpdateRequest): WeeklyGoalResponse =
        weeklyGoalService.update(id, req)

    /** 못 끝낸 주간 목표를 다음 주로 이어간다. 새로 만든 다음 주 목표를 돌려준다. */
    @PostMapping("/{id}/carry-over")
    @ResponseStatus(HttpStatus.CREATED)
    fun carryOver(@PathVariable id: Long, @RequestBody(required = false) req: WeeklyGoalCarryRequest?): WeeklyGoalResponse =
        weeklyGoalService.carryOver(id, req?.monthlyGoalId)

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(@PathVariable id: Long) = weeklyGoalService.delete(id)
}
