package com.jobscheduler.user.dto

import com.jobscheduler.goal.dto.GoalRequest
import com.jobscheduler.user.AppUser
import com.jobscheduler.user.UserPurpose
import jakarta.validation.Valid
import jakarta.validation.constraints.Size
import java.time.OffsetDateTime

data class MeResponse(
    val id: Long,
    val email: String,
    val name: String?,
    val pictureUrl: String?,
    val onboarded: Boolean,
    val purpose: UserPurpose?,
) {
    companion object {
        fun from(u: AppUser) = MeResponse(u.id!!, u.email, u.name, u.pictureUrl, u.onboarded, u.purpose)
    }
}

/** 시작 설정 3단계에서 칠한 칸 하나(이어진 칸은 합쳐서 보낸다) */
data class OnboardingBlock(val startAt: OffsetDateTime, val endAt: OffsetDateTime)

/** 시작 설정을 마칠 때 한 번에 보낸다(docs/design.md 11-6 2-3 ④) */
data class OnboardingRequest(
    /** 이용약관·개인정보 수집·이용 동의. true여야 한다(2-4 ③) */
    val agreed: Boolean = false,
    val purpose: UserPurpose,
    @field:Valid
    val goal: GoalRequest,
    @field:Size(max = 60, message = "칸이 너무 많아요.")
    val blocks: List<OnboardingBlock> = emptyList(),
)

/** 건너뛰기도 동의는 받는다 */
data class OnboardingSkipRequest(val agreed: Boolean = false)
