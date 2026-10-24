package com.jobscheduler.ai

import com.anthropic.client.AnthropicClient
import com.anthropic.client.okhttp.AnthropicOkHttpClient
import com.anthropic.core.JsonValue
import com.anthropic.errors.AnthropicException
import com.anthropic.models.messages.JsonOutputFormat
import com.anthropic.models.messages.MessageCreateParams
import com.anthropic.models.messages.OutputConfig
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.jobscheduler.common.BusinessRuleException
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

/** Claude Haiku 5.5로 주간 피드백을 만든다(9-1). 키는 ANTHROPIC_API_KEY 환경 변수로만 받는다 */
@Component
class AnthropicFeedbackClient(
    @Value("\${ANTHROPIC_API_KEY:}") apiKey: String,
    private val objectMapper: ObjectMapper,
) : FeedbackClient {
    companion object {
        const val MODEL = "claude-haiku-5-5"
        private val SCHEMA = mapOf(
            "type" to "object",
            "properties" to mapOf(
                "summary" to mapOf("type" to "string"),
                "good" to mapOf("type" to "string"),
                "suggestions" to mapOf("type" to "array", "items" to mapOf("type" to "string")),
            ),
            "required" to listOf("summary", "good", "suggestions"),
            "additionalProperties" to false,
        )
    }

    private val client: AnthropicClient? = apiKey.takeIf { it.isNotBlank() }?.let { AnthropicOkHttpClient.builder().apiKey(it).build() }

    override val available: Boolean get() = client != null

    override fun generate(system: String, input: String): WeeklyFeedback {
        val c = client ?: throw BusinessRuleException("지금은 AI 피드백을 쓸 수 없어요.", "AI_UNAVAILABLE")
        val schema = JsonOutputFormat.Schema.builder().apply { SCHEMA.forEach { (k, v) -> putAdditionalProperty(k, JsonValue.from(v)) } }.build()
        val params = MessageCreateParams.builder()
            .model(MODEL)
            .maxTokens(4000L)
            .system(system)
            .outputConfig(OutputConfig.builder().effort(OutputConfig.Effort.LOW).format(JsonOutputFormat.builder().schema(schema).build()).build())
            .addUserMessage(input)
            .build()
        val text = try {
            c.messages().create(params).content().flatMap { it.text().map { t -> listOf(t.text()) }.orElse(emptyList()) }.joinToString("")
        } catch (e: AnthropicException) {
            throw BusinessRuleException("피드백을 만들지 못했어요. 잠시 뒤 다시 해 주세요.", "AI_FAILED")
        }
        if (text.isBlank()) throw BusinessRuleException("피드백을 만들지 못했어요. 잠시 뒤 다시 해 주세요.", "AI_FAILED")
        return objectMapper.readValue<WeeklyFeedback>(text)
    }
}
