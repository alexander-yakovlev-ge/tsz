#!/bin/sh
# Старт API: миграции → seed → сервер (ТЗ п. 2.2, plan.md этап 1).
# При перезагрузке сервера Docker поднимает контейнеры без учёта depends_on,
# поэтому миграции повторяются, пока PostgreSQL не станет доступен.
set -e

attempt=1
until ./node_modules/.bin/prisma migrate deploy; do
  if [ "$attempt" -ge 30 ]; then
    echo "entrypoint: database is still unavailable after $attempt attempts" >&2
    exit 1
  fi
  echo "entrypoint: migrate failed (attempt $attempt), retrying in 2s..." >&2
  attempt=$((attempt + 1))
  sleep 2
done

node dist/seed.js
exec node dist/main.js
