package com.jobscheduler.checklist

import com.jobscheduler.category.CategoryService
import com.jobscheduler.category.dto.CategoryRequest
import com.jobscheduler.checklist.dto.ChecklistItemRequest
import com.jobscheduler.common.BusinessRuleException
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import kotlin.test.assertEquals

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ChecklistServiceTest(
    @Autowired private val checklistService: ChecklistService,
    @Autowired private val categoryService: CategoryService,
) {
    @Test
    fun `분류 순서로 묶고 같은 분류에서는 미완료가 먼저 온다`() {
        val categories = categoryService.list(includeInactive = false)
        val first = categories[0].id
        val second = categories[1].id
        checklistService.create(ChecklistItemRequest(second, "모의 면접"))
        val done = checklistService.create(ChecklistItemRequest(first, " 경력기술서 초안 "))
        checklistService.create(ChecklistItemRequest(first, "포트폴리오 링크"))
        checklistService.update(done.id, ChecklistItemRequest(first, "경력기술서 초안", done = true))

        assertEquals(
            listOf("포트폴리오 링크", "경력기술서 초안", "모의 면접"),
            checklistService.list(null).map { it.content },
        )
        assertEquals(1, checklistService.list(second).size)
    }

    @Test
    fun `비활성 분류에는 새로 넣을 수 없지만 이미 있는 항목은 고칠 수 있다`() {
        val c = categoryService.list(includeInactive = false).last()
        val item = checklistService.create(ChecklistItemRequest(c.id, "정리"))
        categoryService.update(c.id, CategoryRequest(c.name, c.color, c.targetRatio, c.weeklyTargetMinutes, active = false))

        val e = assertThrows<BusinessRuleException> { checklistService.create(ChecklistItemRequest(c.id, "새 항목")) }
        assertEquals("CATEGORY_INACTIVE", e.code)
        assertEquals(true, checklistService.update(item.id, ChecklistItemRequest(c.id, "정리", done = true)).done)

        checklistService.delete(item.id)
        assertEquals(0, checklistService.list(c.id).size)
    }
}
