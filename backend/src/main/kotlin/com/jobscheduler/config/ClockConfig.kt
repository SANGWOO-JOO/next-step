package com.jobscheduler.config

import com.jobscheduler.JobSchedulerApplication
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.time.Clock
import java.time.ZoneId

/** 현재 시각이 규칙에 쓰이는 곳(집중 세션 등)은 이 Clock을 받아 테스트에서 시각을 고정할 수 있게 한다. */
@Configuration
class ClockConfig {
    @Bean
    fun clock(): Clock = Clock.system(ZoneId.of(JobSchedulerApplication.APP_ZONE))
}
