#!/usr/bin/env bash
# EC2에서 SSM Run Command로 실행한다(release.yml). 사용법: deploy.sh <태그> <릴리즈 버킷>
# 새 jar와 운영 Compose 파일을 받아 앱 컨테이너만 다시 켜고, 헬스 체크가 UP이 될 때까지 기다린다.
# 실패하면 이전 jar로 되돌린다(docs/deploy.md 8장 롤백).
set -euo pipefail
TAG="$1"
BUCKET="$2"
cd /opt/next-step/deploy
COMPOSE="docker compose -f docker-compose.prod.yml"

aws s3 cp "s3://$BUCKET/releases/$TAG/next-step-$TAG.jar" app.jar.new --only-show-errors
aws s3 cp "s3://$BUCKET/releases/$TAG/docker-compose.prod.yml" docker-compose.prod.yml --only-show-errors
[ -f app.jar ] && cp app.jar app.jar.prev
mv app.jar.new app.jar

wait_healthy() {
  for _ in $(seq 1 60); do
    if curl -fsS --max-time 3 http://127.0.0.1:8080/actuator/health | grep -q '"UP"'; then return 0; fi
    sleep 3
  done
  return 1
}

# jar는 파일로 붙여 두었으므로 컨테이너를 새로 만들어야 새 jar를 읽는다
$COMPOSE up -d --force-recreate app
if wait_healthy; then
  echo "배포 완료: $TAG"
  exit 0
fi

echo "헬스 체크 실패, 마지막 로그:"
$COMPOSE logs --tail 80 app || true
if [ -f app.jar.prev ]; then
  echo "이전 jar로 되돌린다"
  cp app.jar.prev app.jar
  $COMPOSE up -d --force-recreate app
  wait_healthy && echo "이전 버전으로 복구됨" || echo "이전 버전도 켜지지 않음"
fi
exit 1
