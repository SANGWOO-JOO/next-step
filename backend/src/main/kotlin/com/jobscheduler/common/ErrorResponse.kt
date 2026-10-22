package com.jobscheduler.common

import java.time.OffsetDateTime

data class ErrorResponse(
    val code: String,
    val message: String,
    val fieldErrors: List<FieldError> = emptyList(),
    val timestamp: OffsetDateTime = OffsetDateTime.now(),
) {
    data class FieldError(val field: String, val message: String)
}
