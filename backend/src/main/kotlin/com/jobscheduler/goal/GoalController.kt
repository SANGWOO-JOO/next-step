package com.jobscheduler.goal

import com.jobscheduler.goal.dto.GoalRequest
import com.jobscheduler.goal.dto.GoalResponse
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/goals")
class GoalController(private val goalService: GoalService) {

    /** 최종 목표 목록. 각 목표의 월간 → 주간 트리와 진행률을 함께 반환한다. */
    @GetMapping
    fun list(): List<GoalResponse> = goalService.list()

    @GetMapping("/{id}")
    fun get(@PathVariable id: Long): GoalResponse = goalService.get(id)

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@Valid @RequestBody req: GoalRequest): GoalResponse = goalService.create(req)

    @PutMapping("/{id}")
    fun update(@PathVariable id: Long, @Valid @RequestBody req: GoalRequest): GoalResponse =
        goalService.update(id, req)

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(@PathVariable id: Long) = goalService.delete(id)
}
