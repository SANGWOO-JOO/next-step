package com.jobscheduler.category

import com.jobscheduler.category.dto.CategoryRequest
import com.jobscheduler.category.dto.CategoryResponse
import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.common.NotFoundException
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional
class CategoryService(private val categoryRepository: CategoryRepository) {

    @Transactional(readOnly = true)
    fun list(includeInactive: Boolean): List<CategoryResponse> {
        val categories = if (includeInactive) {
            categoryRepository.findAllByOrderBySortOrderAscIdAsc()
        } else {
            categoryRepository.findAllByActiveTrueOrderBySortOrderAscIdAsc()
        }
        return categories.map(CategoryResponse::from)
    }

    fun create(req: CategoryRequest): CategoryResponse {
        val name = req.name.trim()
        if (categoryRepository.existsByName(name)) throw duplicateName(name)
        if (req.active) checkTargetRatioSum(req.targetRatio, excludeId = null)

        val nextOrder = (categoryRepository.findAll().maxOfOrNull { it.sortOrder } ?: 0) + 1
        val category = Category(
            name = name,
            color = req.color,
            sortOrder = nextOrder,
            targetRatio = req.targetRatio,
            weeklyTargetMinutes = req.weeklyTargetMinutes,
            active = req.active,
        )
        return CategoryResponse.from(categoryRepository.save(category))
    }

    fun update(id: Long, req: CategoryRequest): CategoryResponse {
        val category = get(id)
        val name = req.name.trim()
        if (categoryRepository.existsByNameAndIdNot(name, id)) throw duplicateName(name)
        if (req.active) checkTargetRatioSum(req.targetRatio, excludeId = id)

        category.name = name
        category.color = req.color
        category.targetRatio = req.targetRatio
        category.weeklyTargetMinutes = req.weeklyTargetMinutes
        category.active = req.active
        return CategoryResponse.from(category)
    }

    /** ids 순서대로 sortOrder를 다시 매긴다. 모든 분류(비활성 포함)를 빠짐없이 보내야 한다. */
    fun reorder(ids: List<Long>): List<CategoryResponse> {
        val categories = categoryRepository.findAll()
        if (ids.size != ids.toSet().size || ids.toSet() != categories.map { it.id!! }.toSet()) {
            throw BusinessRuleException("모든 분류를 한 번씩 포함해야 해요.", "INVALID_ORDER")
        }
        val byId = categories.associateBy { it.id!! }
        ids.forEachIndexed { index, id -> byId.getValue(id).sortOrder = index + 1 }
        return list(includeInactive = true)
    }

    /** 목표 등에 새로 지정할 분류를 가져온다. 비활성 분류는 지정할 수 없다. */
    @Transactional(readOnly = true)
    fun getAssignable(id: Long): Category {
        val category = get(id)
        if (!category.active) {
            throw BusinessRuleException("비활성 분류는 지정할 수 없어요: ${category.name}", "CATEGORY_INACTIVE")
        }
        return category
    }

    private fun get(id: Long): Category =
        categoryRepository.findByIdOrNull(id) ?: throw NotFoundException("분류를 찾을 수 없어요: $id")

    /** 활성 분류의 목표 비율 합계는 100%를 넘을 수 없다. */
    private fun checkTargetRatioSum(targetRatio: Int?, excludeId: Long?) {
        val others = categoryRepository.findAllByActiveTrueOrderBySortOrderAscIdAsc()
            .filter { it.id != excludeId }
            .sumOf { it.targetRatio ?: 0 }
        val total = others + (targetRatio ?: 0)
        if (total > 100) {
            throw BusinessRuleException("활성 분류의 목표 비율 합계가 100%를 넘어요. (현재 $total%)", "TARGET_RATIO_EXCEEDED")
        }
    }

    private fun duplicateName(name: String) =
        BusinessRuleException("이미 있는 분류 이름이에요: $name", "DUPLICATE_NAME")
}
