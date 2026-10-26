-- AI 주간 피드백을 마지막으로 받은 시각. 하루 1번 제한에 쓴다(docs/design.md 9-1, 2026-10-26)
ALTER TABLE weekly_journal ADD COLUMN ai_feedback_at TIMESTAMP WITH TIME ZONE;
