-- 1-4f: 하루 목표의 주간 목표 연결을 선택으로
ALTER TABLE daily_goal ALTER COLUMN weekly_goal_id DROP NOT NULL;
