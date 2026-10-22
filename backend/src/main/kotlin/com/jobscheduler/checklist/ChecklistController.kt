package com.jobscheduler.checklist

import com.jobscheduler.checklist.dto.ChecklistItemRequest
import com.jobscheduler.checklist.dto.ChecklistItemResponse
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

@RestController
@RequestMapping("/api/checklist/items")
class ChecklistController(private val checklistService: ChecklistService) {
    @GetMapping
    fun list(@RequestParam(required = false) categoryId: Long?): List<ChecklistItemResponse> =
        checklistService.list(categoryId)

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@Valid @RequestBody req: ChecklistItemRequest): ChecklistItemResponse = checklistService.create(req)

    @PutMapping("/{id}")
    fun update(@PathVariable id: Long, @Valid @RequestBody req: ChecklistItemRequest): ChecklistItemResponse =
        checklistService.update(id, req)

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(@PathVariable id: Long) = checklistService.delete(id)
}
