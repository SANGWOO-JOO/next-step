-- 목표 상태는 진행·완료뿐(docs/design.md 11-6 2-2 추가 결정): 그만둔 목표는 지우므로 남은 상태는 완료로 옮긴다(실제 데이터 없음)
UPDATE goal SET status = 'DONE' WHERE status NOT IN ('ACTIVE', 'DONE');
