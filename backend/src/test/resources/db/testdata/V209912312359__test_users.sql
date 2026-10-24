-- 테스트 전용(docs/design.md 11-6 2-1): 가짜 로그인 사용자 1·2와 각자의 기본 분류.
-- 기본은 사용자 1로 로그인한 상태(TestUserExtension), 격리 테스트에서 2로 바꾼다.
INSERT INTO app_user (id, google_sub, email, name, onboarded) VALUES
    (1, 'test-sub-1', 'user1@example.com', '사용자1', TRUE),
    (2, 'test-sub-2', 'user2@example.com', '사용자2', TRUE);
ALTER TABLE app_user ALTER COLUMN id RESTART WITH 100;

INSERT INTO category (id, name, color, sort_order, icon, user_id) VALUES
    (1, '이력서 작성', '#2563eb', 1, '📝', 1),
    (2, '면접 준비', '#dc2626', 2, '💬', 1),
    (3, 'CS 공부', '#16a34a', 3, '📘', 1),
    (4, '코딩 테스트', '#9333ea', 4, '💻', 1),
    (5, '사이드 프로젝트', '#ea580c', 5, '🛠️', 1),
    (6, '기타', '#6b7280', 6, '📌', 1),
    (7, '이력서 작성', '#2563eb', 1, '📝', 2),
    (8, '기타', '#6b7280', 2, '📌', 2);
ALTER TABLE category ALTER COLUMN id RESTART WITH 100;
