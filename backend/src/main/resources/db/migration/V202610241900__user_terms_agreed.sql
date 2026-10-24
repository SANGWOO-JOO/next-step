-- 2-4 약관 동의(docs/design.md 11-6 2-4 ③): 시작 설정에서 이용약관·개인정보 수집·이용에 동의한 때
ALTER TABLE app_user ADD COLUMN terms_agreed_at TIMESTAMP WITH TIME ZONE;
