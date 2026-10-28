#!/bin/sh
# Smoke-проверка развёрнутого стека (plan.md, разд. 1.1, шаг 7).
# Запуск: make smoke (внутри docker-сети, через Caddy).
set -u
BASE_URL="${BASE_URL:-https://localhost}"
failures=0

check() {
  name="$1"; url="$2"; expected="$3"; pattern="${4:-}"
  body=$(mktemp)
  code=$(curl -sk -o "$body" -w '%{http_code}' --max-time 15 "$url")
  if [ "$code" != "$expected" ]; then
    echo "FAIL  $name: HTTP $code (expected $expected) — $url"
    failures=$((failures + 1))
  elif [ -n "$pattern" ] && ! grep -q "$pattern" "$body"; then
    echo "FAIL  $name: body does not contain '$pattern' — $url"
    failures=$((failures + 1))
  else
    echo "ok    $name"
  fi
  rm -f "$body"
}

check 'api health' "$BASE_URL/api/health" 200 '"status":"ok"'
check 'root → language redirect' "$BASE_URL/" 307
check 'home page (ka)' "$BASE_URL/ka" 200 'თამარ მეფის 1'
check 'home page (ru)' "$BASE_URL/ru" 200 'Тамар Мепе, 1'
check 'home page (en)' "$BASE_URL/en" 200 'Tamar Mepe 1'
check 'login page' "$BASE_URL/ru/login" 200 'type="password"'
check 'announcements (ru)' "$BASE_URL/ru/announcements" 200 '<h1'
check 'documents (ka)' "$BASE_URL/ka/documents" 200 'დოკუმენტები'
check 'contacts (en)' "$BASE_URL/en/contacts" 200 'Contacts'
check 'hreflang on a public page' "$BASE_URL/ru/contacts" 200 'hrefLang="ka"'
check 'contacts API' "$BASE_URL/api/contacts" 200 '"chairmanPhone"'
check 'document categories API' "$BASE_URL/api/document-categories" 200 '"categories"'
check 'robots.txt' "$BASE_URL/robots.txt" 200 'Sitemap:'
check 'sitemap.xml' "$BASE_URL/sitemap.xml" 200 '/ru/announcements'
check 'unknown document → 404' "$BASE_URL/api/documents/00000000-0000-4000-8000-000000000000/download" 404
check 'storage listing is closed' "$BASE_URL/files/" 403
check 'admin without session → login' "$BASE_URL/ru/admin" 307
check 'session without cookie' "$BASE_URL/api/auth/session" 200 '"user":null'
check 'users API without session' "$BASE_URL/api/users" 401
check 'units API without session' "$BASE_URL/api/units" 401
check 'owners API without session' "$BASE_URL/api/owners" 401
check 'my units without session' "$BASE_URL/api/me/units" 401
check 'unit documents without session' "$BASE_URL/api/units/00000000-0000-4000-8000-000000000000/documents" 401
check 'admin units without session → login' "$BASE_URL/ru/admin/units" 307
check 'unknown page' "$BASE_URL/ru/does-not-exist" 404
check 'unknown api route' "$BASE_URL/api/does-not-exist" 404
HTTP_URL=$(echo "$BASE_URL" | sed 's#^https:#http:#')
check 'http → https redirect' "$HTTP_URL/" 308

if [ "$failures" -gt 0 ]; then
  echo "smoke: $failures check(s) failed"
  exit 1
fi
echo 'smoke: all checks passed'
