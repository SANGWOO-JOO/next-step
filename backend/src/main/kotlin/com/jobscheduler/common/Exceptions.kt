package com.jobscheduler.common

/** 요청한 리소스가 없을 때 (404) */
class NotFoundException(message: String) : RuntimeException(message)

/** 비즈니스 규칙 위반 (400). 예: 핵심 하루 목표 3개 초과 */
class BusinessRuleException(message: String, val code: String = "BUSINESS_RULE") : RuntimeException(message)
