package com.jobscheduler.user

import com.jobscheduler.category.CategoryService
import com.jobscheduler.common.NotFoundException
import com.jobscheduler.user.dto.MeResponse
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class UserService(
    private val userRepository: AppUserRepository,
    private val categoryService: CategoryService,
) {
    /**
     * 구글 로그인 때마다 부른다. 처음 온 사람이면 사용자를 만들고 기본 분류를 넣는다.
     * 이름·사진은 매번 구글 값으로 갱신한다(docs/design.md 11-2).
     */
    fun signIn(sub: String, email: String, name: String?, pictureUrl: String?): AppUser {
        val existing = userRepository.findByGoogleSub(sub)
        if (existing != null) {
            existing.email = email
            existing.name = name
            existing.pictureUrl = pictureUrl
            return userRepository.save(existing)
        }
        val created = userRepository.save(AppUser(sub, email, name, pictureUrl))
        // 새 세션(트랜잭션)에서 이 사용자로 저장해야 분류에 user_id가 붙는다
        CurrentUser.runAs(created.id!!) { categoryService.createDefaults() }
        return created
    }

    /** 설정의 "준비 중인 것"(docs/design.md 11-6 2-6 ④) */
    @Transactional
    fun changePurpose(purpose: UserPurpose): MeResponse {
        val user = userRepository.findByIdOrNull(CurrentUser.id()) ?: throw NotFoundException("사용자를 찾을 수 없어요")
        user.purpose = purpose
        return MeResponse.from(user)
    }

    @Transactional(readOnly = true)
    fun me(): MeResponse {
        val user = userRepository.findByIdOrNull(CurrentUser.id()) ?: throw NotFoundException("사용자를 찾을 수 없어요")
        return MeResponse.from(user)
    }
}
