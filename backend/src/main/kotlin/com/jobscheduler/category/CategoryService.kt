package com.jobscheduler.category

import com.jobscheduler.category.dto.CategoryRequest
import com.jobscheduler.category.dto.CategoryResponse
import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.common.NotFoundException
import org.springframework.data.repository.findByIdOrNull
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional
class CategoryService(
    private val categoryRepository: CategoryRepository,
    private val jdbcTemplate: JdbcTemplate,
) {

    @Transactional(readOnly = true)
    fun list(includeInactive: Boolean): List<CategoryResponse> {
        val categories = if (includeInactive) {
            categoryRepository.findAllByOrderBySortOrderAscIdAsc()
        } else {
            categoryRepository.findAllByActiveTrueOrderBySortOrderAscIdAsc()
        }
        val used = usedCategoryIds()
        return categories.map { CategoryResponse.from(it).copy(deletable = it.id !in used) }
    }

    /** 새 사용자의 기본 분류(docs/design.md 11-6 2-1). 목적별 분류는 2-3에서 바꾼다 */
    fun createDefaults() {
        DEFAULTS.forEachIndexed { i, (name, color, icon) ->
            categoryRepository.save(Category(name = name, color = color, sortOrder = i + 1, icon = icon))
        }
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
            icon = req.icon?.trim()?.ifEmpty { null },
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
        category.icon = req.icon?.trim()?.ifEmpty { null }
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

    /** 한 번도 쓰이지 않은 분류만 지운다. 쓰인 분류는 숨기기(비활성)를 쓴다(1-4f ㊶). */
    fun delete(id: Long) {
        val category = get(id)
        if (category.id in usedCategoryIds()) {
            throw BusinessRuleException("이미 쓰인 분류는 지울 수 없어요. 활성 체크를 꺼서 숨겨 주세요.", "CATEGORY_IN_USE")
        }
        categoryRepository.delete(category)
    }

    /** 분류를 참조하는 모든 테이블에서 쓰인 분류 id */
    private fun usedCategoryIds(): Set<Long> =
        USAGE_TABLES.flatMap { table ->
            jdbcTemplate.queryForList("SELECT DISTINCT category_id FROM $table WHERE category_id IS NOT NULL", Long::class.java)
        }.toSet()

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

    companion object {
        private val DEFAULTS = listOf(
            Triple("이력서 작성", "#2563eb", "📝"),
            Triple("면접 준비", "#dc2626", "💬"),
            Triple("CS 공부", "#16a34a", "📘"),
            Triple("코딩 테스트", "#9333ea", "💻"),
            Triple("사이드 프로젝트", "#ea580c", "🛠️"),
            Triple("기타", "#6b7280", "📌"),
        )
        private val USAGE_TABLES = listOf("daily_goal", "weekly_goal", "actual_log", "checklist_item", "focus_session")
    }
}
