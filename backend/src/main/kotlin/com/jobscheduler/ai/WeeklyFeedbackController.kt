package com.jobscheduler.ai

import com.jobscheduler.review.dto.WeeklyJournalResponse
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.format.annotation.DateTimeFormat.ISO
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate

@RestController
@RequestMapping("/api/weekly-journals")
class WeeklyFeedbackController(private val weeklyFeedbackService: WeeklyFeedbackService) {
    /** AI 주간 피드백 만들기, 한 번 더 받기(docs/design.md 9-1) */
    @PostMapping("/{weekStart}/feedback")
    fun create(@PathVariable @DateTimeFormat(iso = ISO.DATE) weekStart: LocalDate): WeeklyJournalResponse =
        weeklyFeedbackService.create(weekStart)
}
