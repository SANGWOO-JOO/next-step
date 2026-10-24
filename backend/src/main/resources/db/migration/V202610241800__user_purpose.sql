-- 2-3 시작 설정(docs/design.md 11-6 2-3): 사용자의 목적(취업 준비생·이직 준비 중)
ALTER TABLE app_user ADD COLUMN purpose VARCHAR(20);
