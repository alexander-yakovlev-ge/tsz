#!/bin/sh
# SeaweedFS: S3-совместимое хранилище файлов. Учётные данные S3 берутся из переменных
# окружения, анонимный доступ запрещён (все бакеты приватные).
set -e
: "${S3_ACCESS_KEY:?S3_ACCESS_KEY is required}"
: "${S3_SECRET_KEY:?S3_SECRET_KEY is required}"

cat > /tmp/s3.json <<JSON
{
  "identities": [
    {
      "name": "app",
      "credentials": [{ "accessKey": "${S3_ACCESS_KEY}", "secretKey": "${S3_SECRET_KEY}" }],
      "actions": ["Admin", "Read", "Write", "List", "Tagging"]
    }
  ]
}
JSON

exec weed server \
  -dir=/data \
  -ip=storage \
  -ip.bind=0.0.0.0 \
  -master.volumeSizeLimitMB=1024 \
  -volume.max=0 \
  -filer \
  -s3 \
  -s3.port=8333 \
  -s3.config=/tmp/s3.json
