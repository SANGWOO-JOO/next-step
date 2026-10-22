package com.jobscheduler.review

import com.jobscheduler.review.dto.MonthlyReviewBrief
import com.jobscheduler.review.dto.MonthlyReviewRequest
import com.jobscheduler.review.dto.MonthlyReviewResponse
import com.jobscheduler.review.dto.WeeklyJournalBrief
import com.jobscheduler.review.dto.WeeklyJournalRequest
import com.jobscheduler.review.dto.WeeklyJournalResponse
import jakarta.validation.Valid
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.format.annotation.DateTimeFormat.ISO
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate
import java.time.YearMonth

@RestController
@RequestMapping("/api/weekly-journals")
class WeeklyJournalController(private val reviewService: ReviewService) {
    /** 저장된 일지 목록 (예: ?from=2026-09-28&to=2026-10-26) */
    @GetMapping
    fun list(
        @RequestParam @DateTimeFormat(iso = ISO.DATE) from: LocalDate,
        @RequestParam @DateTimeFormat(iso = ISO.DATE) to: LocalDate,
    ): List<WeeklyJournalBrief> = reviewService.listJournals(from, to)

    /** 저장한 일지가 없어도 그 주의 요약을 돌려준다. */
    @GetMapping("/{weekStart}")
    fun get(@PathVariable @DateTimeFormat(iso = ISO.DATE) weekStart: LocalDate): WeeklyJournalResponse =
        reviewService.getJournal(weekStart)

    @PutMapping("/{weekStart}")
    fun save(
        @PathVariable @DateTimeFormat(iso = ISO.DATE) weekStart: LocalDate,
        @Valid @RequestBody req: WeeklyJournalRequest,
    ): WeeklyJournalResponse = reviewService.saveJournal(weekStart, req)
}

@RestController
@RequestMapping("/api/monthly-reviews")
class MonthlyReviewController(private val reviewService: ReviewService) {
    /** 저장된 회고 목록 (예: ?from=2026-10&to=2027-03) */
    @GetMapping
    fun list(@RequestParam from: YearMonth, @RequestParam to: YearMonth): List<MonthlyReviewBrief> =
        reviewService.listReviews(from, to)

    @GetMapping("/{month}")
    fun get(@PathVariable month: YearMonth): MonthlyReviewResponse = reviewService.getReview(month)

    @PutMapping("/{month}")
    fun save(@PathVariable month: YearMonth, @Valid @RequestBody req: MonthlyReviewRequest): MonthlyReviewResponse =
        reviewService.saveReview(month, req)
}
