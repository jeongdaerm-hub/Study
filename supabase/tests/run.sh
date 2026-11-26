#!/usr/bin/env bash
# 로컬 Postgres 로 가족 공유 권한 테스트: bash supabase/tests/run.sh
set -euo pipefail
DIR=$(cd "$(dirname "$0")" && pwd)
DB=daro_family_test
psql -q -c "drop database if exists $DB" -c "create database $DB" postgres
psql -q -v ON_ERROR_STOP=1 -d $DB -f "$DIR/supabase_stub.sql"
PGOPTIONS="-c client_min_messages=warning" psql -q -v ON_ERROR_STOP=1 -d $DB -f "$DIR/../migrations/202611260001_family_sharing.sql"
OUT=$(psql -qAt -P footer=off -v ON_ERROR_STOP=1 -d $DB -f "$DIR/rls_test.sql")
echo "$OUT" | grep -v "^$" | tr "\n" " "; echo
if echo "$OUT" | grep -qx 'f'; then echo "✖ 실패한 검사가 있어요"; exit 1; fi
echo "✔ 가족 공유 권한 테스트 통과"
psql -q -c "drop database $DB" postgres
