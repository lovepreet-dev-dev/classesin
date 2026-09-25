#!/usr/bin/env bash
# Runs supabase/tests/*.sql against a throwaway Postgres container.
# Usage: scripts/test-db.sh [schema.sql path]   (defaults to supabase/schema.sql)
set -euo pipefail
cd "$(dirname "$0")/.."

schema="${1:-supabase/schema.sql}"
name="kinship-db-test-$$"
docker run -d --rm --name "$name" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16 >/dev/null
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT
until docker exec "$name" pg_isready -U postgres -q; do sleep 0.5; done
sleep 1

run() { docker exec -i "$name" psql -U postgres -qtA -v ON_ERROR_STOP=1 -f - < "$1"; }
run supabase/tests/local_auth_stub.sql
run "$schema"
for migration in supabase/migrations/*.sql; do run "$migration"; done
for test in supabase/tests/*.sql; do
  [ "$(basename "$test")" = "local_auth_stub.sql" ] && continue
  echo "== $test"
  run "$test" 2>&1 | sed -n 's/^psql:[^ ]* NOTICE:  //p; /ERROR/p'
done
