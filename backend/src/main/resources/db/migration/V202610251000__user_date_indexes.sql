-- 사용자별 날짜 조회용 묶음 인덱스(docs/design.md 배포 전 작업). 모든 조회가 "내 것(user_id) + 날짜 범위"라
-- (user_id, 날짜)로 한 번에 찾게 한다. (user_id) 단독 인덱스는 H2에서 외래 키가 쓰고 있어 그대로 둔다
CREATE INDEX ix_actual_log_user_date ON actual_log (user_id, log_date);
CREATE INDEX ix_time_block_user_date ON time_block (user_id, block_date);
CREATE INDEX ix_daily_goal_user_date ON daily_goal (user_id, goal_date);
