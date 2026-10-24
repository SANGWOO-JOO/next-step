# Problem analysis result: H2에서 외래 키가 쓰는 인덱스를 지우지 못함

- 날짜: 2026-10-24(2-2 목표 구조 개편), 2026-10-25(사용자별 날짜 인덱스), 두 번 발생
- 영역: Flyway 마이그레이션, 테스트 DB(H2 PostgreSQL 모드)와 운영 DB(PostgreSQL 16) 차이
- 관련 파일: `V202610241300__goal_category_unique.sql`, `V202610251000__user_date_indexes.sql`

## 1. 증상
- 마이그레이션에 `DROP INDEX ix_daily_goal_user;`처럼 인덱스를 지우는 줄을 넣자, **테스트 전체(113개)가 시작 단계에서 실패**했다.
- 에러: `Index "ix_daily_goal_user" belongs to constraint "fk_daily_goal_user"`
- 같은 마이그레이션이 PostgreSQL에서는 문제없이 돈다.

## 2. 원인 분석
- PostgreSQL은 외래 키에 인덱스가 **필요 없다.** 외래 키 열에 만든 인덱스는 따로 있는 일반 인덱스라 지워도 된다.
- H2는 외래 키를 만들 때 그 열의 인덱스를 **외래 키가 쓰는 인덱스로 묶는다.** 묶인 인덱스는 외래 키를 먼저 지우지 않으면 지울 수 없다.
- 우리 규칙상 SQL은 PostgreSQL과 H2(PostgreSQL 모드) 양쪽에서 돌아야 한다(CLAUDE.md). 그래서 PostgreSQL에서만 되는 `DROP INDEX`는 쓸 수 없었다.

## 3. 해결
- 1차(2-2): 유일 제약으로 바꿀 때 기존 인덱스를 지우는 줄을 빼고 `ADD CONSTRAINT … UNIQUE`만 남김
- 2차(배포 전 인덱스): `(user_id, 날짜)` 묶음 인덱스만 추가하고 `(user_id)` 단독 인덱스는 **그대로 둠**. 인덱스가 하나씩 더 있어 저장할 때 아주 조금 느려지지만 지금 규모에서는 차이가 없다
- 운영 PostgreSQL에서 `EXPLAIN`으로 새 인덱스(`ix_actual_log_user_date`)를 쓰는 것을 확인

## 4. 배운 점
- **마이그레이션에서 인덱스나 제약을 지울 때는 H2부터 의심한다.** 외래 키가 걸린 열의 인덱스는 H2에서 지울 수 없다고 보고 설계한다.
- 지워야만 한다면 순서: 외래 키 삭제 → 인덱스 삭제 → 외래 키 다시 만들기. 양쪽 DB에서 같은 문법인지 확인한다.
- 같은 문제가 두 번 났다. 처음 났을 때 기록해 뒀다면 두 번째는 피할 수 있었다. 이 문서가 그 기록이다.
