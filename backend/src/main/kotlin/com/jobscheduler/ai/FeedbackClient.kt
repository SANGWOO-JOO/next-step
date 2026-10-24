package com.jobscheduler.ai

/** 주간 피드백 결과(docs/design.md 9-1): 한 줄 요약, 잘한 점 1개, 다음 주 제안 1~2개 */
data class WeeklyFeedback(val summary: String, val good: String, val suggestions: List<String>)

/** Claude 호출을 감싼다. 테스트는 가짜로 바꿔 끼운다 */
interface FeedbackClient {
    /** API 키가 있어 부를 수 있는지 */
    val available: Boolean

    fun generate(system: String, input: String): WeeklyFeedback
}
