-- 목표 상태는 완료·보관 둘(docs/design.md 11-6 2-2 추가 결정): 멈춤·그만둠은 보관으로
UPDATE goal SET status = 'ARCHIVED' WHERE status IN ('PAUSED', 'DROPPED');
