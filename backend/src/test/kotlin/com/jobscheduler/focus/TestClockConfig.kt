package com.jobscheduler.focus

import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Primary
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneId

/** 테스트에서 시각을 직접 옮길 수 있는 Clock */
class MutableClock(var instant: Instant, private val zone: ZoneId = ZoneId.of("Asia/Seoul")) : Clock() {
    override fun getZone(): ZoneId = zone
    override fun withZone(zone: ZoneId): Clock = MutableClock(instant, zone)
    override fun instant(): Instant = instant

    fun advance(duration: Duration) {
        instant = instant.plus(duration)
    }
}

@TestConfiguration
class TestClockConfig {
    @Bean
    @Primary
    fun mutableClock() = MutableClock(Instant.parse("2026-10-22T00:00:00Z"))
}
