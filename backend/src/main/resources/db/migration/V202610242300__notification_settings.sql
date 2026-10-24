-- 1-5 앱 안 알림 설정(docs/design.md 10장 1-5): 종류별 켜기와 끄기, 하루 마무리 알림 시각
ALTER TABLE app_user ADD COLUMN notify_block BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE app_user ADD COLUMN notify_today BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE app_user ADD COLUMN notify_weekly BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE app_user ADD COLUMN notify_shutdown BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE app_user ADD COLUMN shutdown_hour INT NOT NULL DEFAULT 21;
