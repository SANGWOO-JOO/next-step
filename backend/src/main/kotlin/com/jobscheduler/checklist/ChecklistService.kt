package com.jobscheduler.checklist

import com.jobscheduler.category.CategoryService
import com.jobscheduler.checklist.dto.ChecklistItemRequest
import com.jobscheduler.checklist.dto.ChecklistItemResponse
import com.jobscheduler.common.NotFoundException
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional
class ChecklistService(
    private val itemRepository: ChecklistItemRepository,
    private val categoryService: CategoryService,
) {
    /** 분류 순서 → 미완료 먼저 → 순서. categoryId를 주면 그 분류만 */
    @Transactional(readOnly = true)
    fun list(categoryId: Long?): List<ChecklistItemResponse> =
        (categoryId?.let(itemRepository::findAllByCategoryId) ?: itemRepository.findAll())
            .sortedWith(compareBy({ it.category.sortOrder }, { it.category.id }, { it.done }, { it.sortOrder }, { it.id }))
            .map(ChecklistItemResponse::from)

    fun create(req: ChecklistItemRequest): ChecklistItemResponse {
        val category = categoryService.getAssignable(req.categoryId)
        val item = itemRepository.save(
            ChecklistItem(category, req.content.trim(), nextSortOrder(req.categoryId), req.done),
        )
        return ChecklistItemResponse.from(item)
    }

    fun update(id: Long, req: ChecklistItemRequest): ChecklistItemResponse {
        val item = getEntity(id)
        // 이미 지정된 분류는 비활성이어도 유지하고, 다른 분류로 옮길 때만 활성 여부를 본다
        if (req.categoryId != item.category.id) {
            item.category = categoryService.getAssignable(req.categoryId)
            item.sortOrder = nextSortOrder(req.categoryId)
        }
        item.content = req.content.trim()
        item.done = req.done
        return ChecklistItemResponse.from(item)
    }

    fun delete(id: Long) {
        itemRepository.delete(getEntity(id))
    }

    private fun nextSortOrder(categoryId: Long) = itemRepository.countByCategoryId(categoryId).toInt() + 1

    private fun getEntity(id: Long): ChecklistItem =
        itemRepository.findByIdOrNull(id) ?: throw NotFoundException("체크리스트 항목을 찾을 수 없어요: $id")
}
