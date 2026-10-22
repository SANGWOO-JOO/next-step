package com.jobscheduler.checklist.dto

import com.jobscheduler.checklist.ChecklistItem
import com.jobscheduler.goal.dto.CategoryRef
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

data class ChecklistItemRequest(
    val categoryId: Long,
    @field:NotBlank(message = "내용을 입력해주세요.")
    @field:Size(max = 500, message = "내용은 500자 이하로 입력해주세요.")
    val content: String,
    val done: Boolean = false,
)

data class ChecklistItemResponse(
    val id: Long,
    val category: CategoryRef,
    val content: String,
    val done: Boolean,
    val sortOrder: Int,
) {
    companion object {
        fun from(i: ChecklistItem) = ChecklistItemResponse(i.id!!, CategoryRef.from(i.category), i.content, i.done, i.sortOrder)
    }
}
