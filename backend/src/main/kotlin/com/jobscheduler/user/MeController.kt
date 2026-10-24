package com.jobscheduler.user

import com.jobscheduler.user.dto.MeResponse
import com.jobscheduler.user.dto.OnboardingRequest
import jakarta.validation.Valid
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/me")
class MeController(
    private val userService: UserService,
    private val onboardingService: OnboardingService,
) {
    /** 로그인한 사용자. 로그인 안 했으면 보안 설정이 401을 돌려준다 */
    @GetMapping
    fun me(): MeResponse = userService.me()

    /** 시작 설정 마치기(2-3). 목적·첫 목표·이번 주 블록을 한 번에 */
    @PostMapping("/onboarding")
    fun completeOnboarding(@Valid @RequestBody req: OnboardingRequest): MeResponse = onboardingService.complete(req)

    /** 시작 설정 건너뛰기(이미 쓰던 사람) */
    @PostMapping("/onboarding/skip")
    fun skipOnboarding(): MeResponse = onboardingService.skip()
}
