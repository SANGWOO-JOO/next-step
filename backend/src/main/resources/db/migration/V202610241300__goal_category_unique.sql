-- 목표 하나로 통일(docs/design.md 11-6 2-2 추가 결정 ①): 목표와 분류는 1:1
ALTER TABLE goal ADD CONSTRAINT uq_goal_category UNIQUE (category_id);
