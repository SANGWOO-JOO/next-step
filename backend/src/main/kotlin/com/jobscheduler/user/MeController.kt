package com.jobscheduler.user

import com.jobscheduler.user.dto.MeResponse
import com.jobscheduler.user.dto.OnboardingRequest
import com.jobscheduler.user.dto.NotificationSettings
import com.jobscheduler.user.dto.OnboardingSkipRequest
import com.jobscheduler.user.dto.PurposeRequest
import jakarta.validation.Valid
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/me")
class MeController(
    private val userService: UserService,
    private val onboardingService: OnboardingService,
    private val withdrawalService: WithdrawalService,
) {
    /** 로그인한 사용자. 로그인 안 했으면 보안 설정이 401을 돌려준다 */
    @GetMapping
    fun me(): MeResponse = userService.me()

    /** 시작 설정 마치기(2-3). 목적·첫 목표·이번 주 블록을 한 번에 */
    @PostMapping("/onboarding")
    fun completeOnboarding(@Valid @RequestBody req: OnboardingRequest): MeResponse = onboardingService.complete(req)

    /** 시작 설정 건너뛰기(이미 쓰던 사람) */
    @PostMapping("/onboarding/skip")
    fun skipOnboarding(@RequestBody req: OnboardingSkipRequest): MeResponse = onboardingService.skip(req.agreed)

    /** 준비 중인 것 바꾸기(2-6) */
    @PatchMapping("/purpose")
    fun changePurpose(@RequestBody req: PurposeRequest): MeResponse = userService.changePurpose(req.purpose)

    /** 앱 안 알림 설정(1-5) */
    @PatchMapping("/notifications")
    fun changeNotifications(@Valid @RequestBody req: NotificationSettings): MeResponse = userService.changeNotifications(req)

    /** AI 주간 피드백 동의(9-1) */
    @PostMapping("/ai-consent")
    fun agreeAi(): MeResponse = userService.setAiConsent(true)

    /** AI 주간 피드백 동의 끄기 */
    @DeleteMapping("/ai-consent")
    fun withdrawAi(): MeResponse = userService.setAiConsent(false)

    /** 회원 탈퇴(2-4). 모든 기록과 계정을 지우고 로그인 세션도 끝낸다 */
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun withdraw(request: HttpServletRequest) {
        withdrawalService.withdraw(CurrentUser.id())
        SecurityContextHolder.clearContext()
        request.getSession(false)?.invalidate()
    }
}
