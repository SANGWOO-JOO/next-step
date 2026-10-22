package com.jobscheduler.common

import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.servlet.resource.NoResourceFoundException

@RestControllerAdvice
class GlobalExceptionHandler {
    private val log = LoggerFactory.getLogger(javaClass)

    @ExceptionHandler(NotFoundException::class)
    fun notFound(e: NotFoundException) =
        error(HttpStatus.NOT_FOUND, "NOT_FOUND", e.message ?: "리소스를 찾을 수 없어요.")

    @ExceptionHandler(NoResourceFoundException::class)
    fun noResource(e: NoResourceFoundException) =
        error(HttpStatus.NOT_FOUND, "NOT_FOUND", "요청한 경로가 없어요.")

    @ExceptionHandler(BusinessRuleException::class)
    fun businessRule(e: BusinessRuleException) =
        error(HttpStatus.BAD_REQUEST, e.code, e.message ?: "요청을 처리할 수 없어요.")

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun invalid(e: MethodArgumentNotValidException): ResponseEntity<ErrorResponse> {
        val fields = e.bindingResult.fieldErrors.map {
            ErrorResponse.FieldError(it.field, it.defaultMessage ?: "올바르지 않은 값이에요.")
        }
        return ResponseEntity.badRequest()
            .body(ErrorResponse("VALIDATION_FAILED", "입력값을 확인해주세요.", fields))
    }

    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun unreadable(e: HttpMessageNotReadableException) =
        error(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "요청 본문을 읽을 수 없어요.")

    @ExceptionHandler(Exception::class)
    fun unexpected(e: Exception): ResponseEntity<ErrorResponse> {
        log.error("Unexpected error", e)
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "서버 오류가 발생했어요.")
    }

    private fun error(status: HttpStatus, code: String, message: String) =
        ResponseEntity.status(status).body(ErrorResponse(code, message))
}
