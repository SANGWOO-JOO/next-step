package com.jobscheduler.record

import com.jobscheduler.category.CategoryService
import com.jobscheduler.common.NotFoundException
import com.jobscheduler.record.dto.ManualStudyLogRequest
import com.jobscheduler.record.dto.ManualStudyLogResponse
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate

@Service
@Transactional
class ManualStudyLogService(
    private val manualLogRepository: ManualStudyLogRepository,
    private val categoryService: CategoryService,
) {
    @Transactional(readOnly = true)
    fun list(date: LocalDate): List<ManualStudyLogResponse> =
        manualLogRepository.findAllByDateOrderByCreatedAtAscIdAsc(date).map(ManualStudyLogResponse::from)

    fun create(req: ManualStudyLogRequest): ManualStudyLogResponse {
        val log = manualLogRepository.save(
            ManualStudyLog(req.date, categoryService.getAssignable(req.categoryId), req.minutes, cleanMemo(req.memo)),
        )
        return ManualStudyLogResponse.from(log)
    }

    fun update(id: Long, req: ManualStudyLogRequest): ManualStudyLogResponse {
        val log = getEntity(id)
        // 이미 지정된 분류는 비활성이어도 유지하고, 새로 지정할 때만 활성 여부를 본다
        if (req.categoryId != log.category.id) log.category = categoryService.getAssignable(req.categoryId)
        log.date = req.date
        log.minutes = req.minutes
        log.memo = cleanMemo(req.memo)
        return ManualStudyLogResponse.from(log)
    }

    fun delete(id: Long) {
        manualLogRepository.delete(getEntity(id))
    }

    private fun cleanMemo(memo: String?) = memo?.trim()?.ifEmpty { null }

    private fun getEntity(id: Long): ManualStudyLog =
        manualLogRepository.findByIdOrNull(id) ?: throw NotFoundException("수동 공부 기록을 찾을 수 없어요: $id")
}
