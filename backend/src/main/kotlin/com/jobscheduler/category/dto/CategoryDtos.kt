package com.jobscheduler.category.dto

import com.jobscheduler.category.Category
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.Pattern
import jakarta.validation.constraints.Size

data class CategoryRequest(
    @field:NotBlank(message = "이름을 입력해주세요.")
    @field:Size(max = 50, message = "이름은 50자 이하로 입력해주세요.")
    val name: String,
    @field:Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "색상은 #RRGGBB 형식이어야 해요.")
    val color: String,
    @field:Min(0, message = "목표 비율은 0~100 사이여야 해요.")
    @field:Max(100, message = "목표 비율은 0~100 사이여야 해요.")
    val targetRatio: Int? = null,
    @field:Min(0, message = "주간 목표 시간은 0 이상이어야 해요.")
    val weeklyTargetMinutes: Int? = null,
    val active: Boolean = true,
    @field:Size(max = 16, message = "아이콘은 16자 이하로 입력해주세요.")
    val icon: String? = null,
)

data class CategoryOrderRequest(
    @field:NotEmpty(message = "순서를 입력해주세요.")
    val ids: List<Long>,
)

data class CategoryResponse(
    val id: Long,
    val name: String,
    val color: String,
    val sortOrder: Int,
    val targetRatio: Int?,
    val weeklyTargetMinutes: Int?,
    val active: Boolean,
    val icon: String?,
    /** 어디에도 쓰이지 않아 지울 수 있는지(목록 조회에서만 채움) */
    val deletable: Boolean = false,
) {
    companion object {
        fun from(c: Category) = CategoryResponse(
            id = c.id!!,
            name = c.name,
            color = c.color,
            sortOrder = c.sortOrder,
            targetRatio = c.targetRatio,
            weeklyTargetMinutes = c.weeklyTargetMinutes,
            active = c.active,
            icon = c.icon,
        )
    }
}
