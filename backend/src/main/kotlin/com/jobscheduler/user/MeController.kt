package com.jobscheduler.user

import com.jobscheduler.user.dto.MeResponse
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/me")
class MeController(private val userService: UserService) {
    /** 로그인한 사용자. 로그인 안 했으면 보안 설정이 401을 돌려준다 */
    @GetMapping
    fun me(): MeResponse = userService.me()
}
