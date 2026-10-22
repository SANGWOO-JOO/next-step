-- 1-0 기본 틀: 스키마 버전 관리 시작점.
-- 실제 테이블(분류, 목표 구조 등)은 1-1부터 V2 이후 마이그레이션으로 추가합니다.
CREATE TABLE app_info (
    id         SMALLINT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO app_info (id) VALUES (1);
