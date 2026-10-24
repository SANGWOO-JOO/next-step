-- 3단계 AI 주간 피드백(docs/design.md 9-1): 주마다 만든 횟수, 사용자 동의 시각
ALTER TABLE weekly_journal ADD COLUMN ai_feedback_count INT NOT NULL DEFAULT 0;
ALTER TABLE app_user ADD COLUMN ai_agreed_at TIMESTAMP WITH TIME ZONE;
