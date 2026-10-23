-- 1-4f: 주 보기의 "계획"(weekly_plan)을 하루 목표로 합친다.
-- 같은 날 같은 내용의 하루 목표가 있으면 건너뛰고, 나머지는 그 날짜의 추가(EXTRA) 목표 뒤에 붙인다.
INSERT INTO daily_goal (weekly_goal_id, goal_date, content, category_id, goal_type, sort_order, status, carry_count, created_at, updated_at)
SELECT p.weekly_goal_id,
       p.plan_date,
       p.content,
       w.category_id,
       'EXTRA',
       (SELECT COALESCE(MAX(d.sort_order), 0) FROM daily_goal d WHERE d.goal_date = p.plan_date AND d.goal_type = 'EXTRA') + p.sort_order,
       'TODO',
       0,
       p.created_at,
       p.created_at
FROM weekly_plan p
JOIN weekly_goal w ON w.id = p.weekly_goal_id
WHERE NOT EXISTS (SELECT 1 FROM daily_goal d WHERE d.goal_date = p.plan_date AND d.content = p.content);

DROP TABLE weekly_plan;
