package com.jobscheduler.focus

import com.jobscheduler.common.NotFoundException
import com.jobscheduler.focus.dto.DistractionNoteResponse
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.OffsetDateTime

@Service
@Transactional
class DistractionNoteService(
    private val noteRepository: DistractionNoteRepository,
    private val focusSessionService: FocusSessionService,
    private val clock: Clock,
) {
    /** checked가 null이면 전체, 최신순 */
    @Transactional(readOnly = true)
    fun list(checked: Boolean?): List<DistractionNoteResponse> =
        (checked?.let(noteRepository::findAllByCheckedOrderByCreatedAtDesc) ?: noteRepository.findAllByOrderByCreatedAtDesc())
            .map(DistractionNoteResponse::from)

    /** 딴생각 메모는 세션이 끝난 뒤에도 붙일 수 있다(결과 카드에서 덧붙이기). */
    fun add(sessionId: Long, content: String): DistractionNoteResponse {
        val session = focusSessionService.getEntity(sessionId)
        val note = noteRepository.save(DistractionNote(session, content.trim(), createdAt = OffsetDateTime.now(clock)))
        return DistractionNoteResponse.from(note)
    }

    fun check(id: Long, checked: Boolean): DistractionNoteResponse {
        val note = noteRepository.findByIdOrNull(id) ?: throw NotFoundException("메모를 찾을 수 없어요: $id")
        note.checked = checked
        return DistractionNoteResponse.from(note)
    }
}
