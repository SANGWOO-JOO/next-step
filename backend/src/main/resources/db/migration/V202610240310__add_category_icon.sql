-- 분류 아이콘(docs/design.md 1-4f ㊻): 시간표 블록 이름 앞에 붙이는 이모지 하나
ALTER TABLE category ADD COLUMN icon VARCHAR(16);

UPDATE category SET icon = '📝' WHERE name = '이력서 작성';
UPDATE category SET icon = '💬' WHERE name = '면접 준비';
UPDATE category SET icon = '📘' WHERE name = 'CS 공부';
UPDATE category SET icon = '💻' WHERE name = '코딩 테스트';
UPDATE category SET icon = '🛠️' WHERE name = '사이드 프로젝트';
UPDATE category SET icon = '📌' WHERE name = '기타';
