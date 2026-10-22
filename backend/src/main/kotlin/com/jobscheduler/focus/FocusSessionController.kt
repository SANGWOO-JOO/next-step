package com.jobscheduler.focus

import com.jobscheduler.focus.dto.DistractionNoteCheckRequest
import com.jobscheduler.focus.dto.DistractionNoteRequest
import com.jobscheduler.focus.dto.DistractionNoteResponse
import com.jobscheduler.focus.dto.FocusCategoryRequest
import com.jobscheduler.focus.dto.FocusEndRequest
import com.jobscheduler.focus.dto.FocusSessionResponse
import com.jobscheduler.focus.dto.FocusStartRequest
import com.jobscheduler.focus.dto.InterruptionEndRequest
import com.jobscheduler.focus.dto.InterruptionStartRequest
import jakarta.validation.Valid
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.format.annotation.DateTimeFormat.ISO
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate

@RestController
@RequestMapping("/api/focus-sessions")
class FocusSessionController(
    private val focusSessionService: FocusSessionService,
    private val noteService: DistractionNoteService,
) {
    @GetMapping
    fun list(@RequestParam @DateTimeFormat(iso = ISO.DATE) date: LocalDate): List<FocusSessionResponse> =
        focusSessionService.listByDate(date)

    /** 진행 중 세션. 없으면 204 */
    @GetMapping("/current")
    fun current(): ResponseEntity<FocusSessionResponse> =
        focusSessionService.current()?.let { ResponseEntity.ok(it) } ?: ResponseEntity.noContent().build()

    @GetMapping("/{id}")
    fun get(@PathVariable id: Long): FocusSessionResponse = focusSessionService.get(id)

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun start(@Valid @RequestBody req: FocusStartRequest): FocusSessionResponse = focusSessionService.start(req)

    @PostMapping("/{id}/end")
    fun end(@PathVariable id: Long, @RequestBody req: FocusEndRequest): FocusSessionResponse =
        focusSessionService.end(id, req.result)

    @PatchMapping("/{id}/category")
    fun changeCategory(@PathVariable id: Long, @RequestBody req: FocusCategoryRequest): FocusSessionResponse =
        focusSessionService.changeCategory(id, req.categoryId)

    @PostMapping("/{id}/interruptions")
    fun startInterruption(@PathVariable id: Long, @RequestBody req: InterruptionStartRequest): FocusSessionResponse =
        focusSessionService.startInterruption(id, req)

    @PostMapping("/{id}/interruptions/{interruptionId}/end")
    fun endInterruption(
        @PathVariable id: Long,
        @PathVariable interruptionId: Long,
        @Valid @RequestBody req: InterruptionEndRequest,
    ): FocusSessionResponse = focusSessionService.endInterruption(id, interruptionId, req)

    @PostMapping("/{id}/notes")
    @ResponseStatus(HttpStatus.CREATED)
    fun addNote(@PathVariable id: Long, @Valid @RequestBody req: DistractionNoteRequest): DistractionNoteResponse =
        noteService.add(id, req.content)
}

@RestController
@RequestMapping("/api/distraction-notes")
class DistractionNoteController(private val noteService: DistractionNoteService) {
    @GetMapping
    fun list(@RequestParam(required = false) checked: Boolean?): List<DistractionNoteResponse> = noteService.list(checked)

    @PatchMapping("/{id}")
    fun check(@PathVariable id: Long, @RequestBody req: DistractionNoteCheckRequest): DistractionNoteResponse =
        noteService.check(id, req.checked)
}
