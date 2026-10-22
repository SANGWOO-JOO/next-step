package com.jobscheduler.category

import com.jobscheduler.category.dto.CategoryOrderRequest
import com.jobscheduler.category.dto.CategoryRequest
import com.jobscheduler.category.dto.CategoryResponse
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
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
@RequestMapping("/api/categories")
class CategoryController(private val categoryService: CategoryService) {

    @GetMapping
    fun list(@RequestParam(defaultValue = "false") includeInactive: Boolean): List<CategoryResponse> =
        categoryService.list(includeInactive)

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@Valid @RequestBody req: CategoryRequest): CategoryResponse = categoryService.create(req)

    @PutMapping("/{id}")
    fun update(@PathVariable id: Long, @Valid @RequestBody req: CategoryRequest): CategoryResponse =
        categoryService.update(id, req)

    @PutMapping("/order")
    fun reorder(@Valid @RequestBody req: CategoryOrderRequest): List<CategoryResponse> =
        categoryService.reorder(req.ids)
}
