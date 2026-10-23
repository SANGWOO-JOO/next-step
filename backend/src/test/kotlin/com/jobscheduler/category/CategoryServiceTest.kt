package com.jobscheduler.category

import com.jobscheduler.category.dto.CategoryRequest
import com.jobscheduler.common.BusinessRuleException
import com.jobscheduler.daily.DailyGoalService
import com.jobscheduler.daily.dto.DailyGoalCreateRequest
import java.time.LocalDate
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class CategoryServiceTest(
    @Autowired private val categoryService: CategoryService,
    @Autowired private val dailyGoalService: DailyGoalService,
) {

    @Test
    fun `기본 분류 6개가 순서대로 들어 있다`() {
        val names = categoryService.list(includeInactive = false).map { it.name }
        assertEquals(listOf("이력서 작성", "면접 준비", "CS 공부", "코딩 테스트", "사이드 프로젝트", "기타"), names)
    }

    @Test
    fun `새 분류는 맨 뒤 순서로 추가된다`() {
        val created = categoryService.create(CategoryRequest(name = " 네트워킹 ", color = "#000000"))
        assertEquals("네트워킹", created.name)
        assertEquals(7, created.sortOrder)
    }

    @Test
    fun `이름이 겹치면 추가할 수 없다`() {
        val e = assertThrows<BusinessRuleException> {
            categoryService.create(CategoryRequest(name = "CS 공부", color = "#000000"))
        }
        assertEquals("DUPLICATE_NAME", e.code)
    }

    @Test
    fun `활성 분류의 목표 비율 합계는 100을 넘을 수 없다`() {
        val categories = categoryService.list(includeInactive = false)
        val first = categories[0]
        categoryService.update(first.id, request(first.name, targetRatio = 60))

        val second = categories[1]
        val e = assertThrows<BusinessRuleException> {
            categoryService.update(second.id, request(second.name, targetRatio = 50))
        }
        assertEquals("TARGET_RATIO_EXCEEDED", e.code)

        // 비활성 분류의 비율은 합계에 들어가지 않는다
        categoryService.update(second.id, request(second.name, targetRatio = 50, active = false))
    }

    @Test
    fun `비활성 분류는 목록에서 빠지고 새로 지정할 수 없다`() {
        val target = categoryService.list(includeInactive = false).last()
        categoryService.update(target.id, request(target.name, active = false))

        assertFalse(categoryService.list(includeInactive = false).any { it.id == target.id })
        assertEquals(6, categoryService.list(includeInactive = true).size)
        val e = assertThrows<BusinessRuleException> { categoryService.getAssignable(target.id) }
        assertEquals("CATEGORY_INACTIVE", e.code)
    }

    @Test
    fun `순서를 바꾸려면 모든 분류를 보내야 한다`() {
        val ids = categoryService.list(includeInactive = true).map { it.id }

        val reordered = categoryService.reorder(ids.reversed())
        assertEquals(ids.reversed(), reordered.map { it.id })

        val e = assertThrows<BusinessRuleException> { categoryService.reorder(ids.drop(1)) }
        assertEquals("INVALID_ORDER", e.code)
    }

    @Test
    fun `쓰이지 않은 분류는 지울 수 있다`() {
        val created = categoryService.create(CategoryRequest(name = "[확인용] 실수", color = "#000000"))
        assertTrue(categoryService.list(includeInactive = true).single { it.id == created.id }.deletable)

        categoryService.delete(created.id)
        assertFalse(categoryService.list(includeInactive = true).any { it.id == created.id })
    }

    @Test
    fun `쓰인 분류는 지울 수 없고 숨기기만 된다`() {
        val created = categoryService.create(CategoryRequest(name = "[확인용] 쓰임", color = "#000000"))
        dailyGoalService.create(DailyGoalCreateRequest(date = LocalDate.of(2026, 10, 24), content = "할 일", categoryId = created.id))
        assertFalse(categoryService.list(includeInactive = true).single { it.id == created.id }.deletable)

        val e = assertThrows<BusinessRuleException> { categoryService.delete(created.id) }
        assertEquals("CATEGORY_IN_USE", e.code)
    }

    @Test
    fun `분류 아이콘을 저장하고 비우면 없앤다`() {
        val created = categoryService.create(CategoryRequest(name = "[확인용] 아이콘", color = "#000000", icon = "☕"))
        assertEquals("☕", created.icon)

        val cleared = categoryService.update(created.id, CategoryRequest(name = created.name, color = "#000000", icon = " "))
        assertEquals(null, cleared.icon)
    }

    @Test
    fun `기본 분류에는 아이콘이 미리 들어 있다`() {
        val icons = categoryService.list(includeInactive = false).associate { it.name to it.icon }
        assertEquals("📘", icons["CS 공부"])
    }

    private fun request(name: String, targetRatio: Int? = null, active: Boolean = true) =
        CategoryRequest(name = name, color = "#123456", targetRatio = targetRatio, active = active)
}
