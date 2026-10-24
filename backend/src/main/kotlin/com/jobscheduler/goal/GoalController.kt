package com.jobscheduler.goal

import com.jobscheduler.goal.dto.GoalRequest
import com.jobscheduler.goal.dto.GoalResponse
import com.jobscheduler.goal.dto.GoalStatusRequest
import com.jobscheduler.goal.dto.WeekPlanResponse
import jakarta.validation.Valid
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate

@RestController
class GoalController(private val goalService: GoalService) {

    @GetMapping("/api/goals")
    fun list(): List<GoalResponse> = goalService.list()

    @GetMapping("/api/goals/{id}")
    fun get(@PathVariable id: Long): GoalResponse = goalService.get(id)

    @PostMapping("/api/goals")
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@Valid @RequestBody req: GoalRequest): GoalResponse = goalService.create(req)

    @PutMapping("/api/goals/{id}")
    fun update(@PathVariable id: Long, @Valid @RequestBody req: GoalRequest): GoalResponse = goalService.update(id, req)

    @PatchMapping("/api/goals/{id}/status")
    fun changeStatus(@PathVariable id: Long, @RequestBody req: GoalStatusRequest): GoalResponse =
        goalService.changeStatus(id, req.status)

    @DeleteMapping("/api/goals/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(@PathVariable id: Long) = goalService.delete(id)

    /** 계획 화면: 이번 주에 무엇을 얼마나(docs/design.md 11-4) */
    @GetMapping("/api/plan/week")
    fun week(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) start: LocalDate): WeekPlanResponse =
        goalService.week(start)
}
