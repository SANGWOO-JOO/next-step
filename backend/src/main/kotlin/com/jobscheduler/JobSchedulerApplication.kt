package com.jobscheduler

import jakarta.annotation.PostConstruct
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import java.util.TimeZone

@SpringBootApplication
class JobSchedulerApplication {
    @PostConstruct
    fun setDefaultTimeZone() {
        TimeZone.setDefault(TimeZone.getTimeZone(APP_ZONE))
    }

    companion object {
        const val APP_ZONE = "Asia/Seoul"
    }
}

fun main(args: Array<String>) {
    TimeZone.setDefault(TimeZone.getTimeZone(JobSchedulerApplication.APP_ZONE))
    runApplication<JobSchedulerApplication>(*args)
}
