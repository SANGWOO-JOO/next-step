-- 1-2c 목표가 아닌 일정(밥 먹기, 산책 등)도 시간 블록으로 넣는다. 하루 목표가 없으면 제목이 있어야 한다.
ALTER TABLE time_block ALTER COLUMN daily_goal_id DROP NOT NULL;
ALTER TABLE time_block ADD COLUMN title VARCHAR(100);
ALTER TABLE time_block ADD CONSTRAINT ck_time_block_goal_or_title CHECK (daily_goal_id IS NOT NULL OR title IS NOT NULL);
