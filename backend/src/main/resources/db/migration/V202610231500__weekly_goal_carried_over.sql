-- 1-4c 못 끝낸 주간 목표를 다음 주로 이어간 표시
ALTER TABLE weekly_goal ADD COLUMN carried_over BOOLEAN NOT NULL DEFAULT FALSE;
