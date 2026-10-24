-- 분류 아이콘을 목표 아이콘으로(docs/design.md 11-6 2-7). 1-4f 이모지는 지우고 목표 아이콘 이름을 옮긴다
ALTER TABLE category ALTER COLUMN icon SET DATA TYPE VARCHAR(40);
UPDATE category SET icon = NULL;
UPDATE category SET icon = (SELECT g.icon FROM goal g WHERE g.category_id = category.id);
