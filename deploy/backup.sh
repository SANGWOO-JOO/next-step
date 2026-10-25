#!/usr/bin/env bash
# 매일 DB 백업을 S3에 올린다(docs/deploy.md 7장). 서버 cron에서 deploy 폴더 기준으로 실행.
# 7일 보관은 S3 수명 주기 규칙이 지운다. 복구: gunzip 없이 pg_restore -d jobscheduler <파일>
set -euo pipefail
cd "$(dirname "$0")"
: "${BACKUP_BUCKET:?BACKUP_BUCKET이 필요해요 (예: next-step-backups)}"

file="jobscheduler-$(TZ=Asia/Seoul date +%Y%m%d-%H%M).dump"
docker compose -f docker-compose.prod.yml exec -T db pg_dump -U jobscheduler -Fc jobscheduler > "/tmp/$file"
aws s3 cp "/tmp/$file" "s3://$BACKUP_BUCKET/db/$file" --only-show-errors
rm -f "/tmp/$file"
echo "백업 완료: s3://$BACKUP_BUCKET/db/$file"
