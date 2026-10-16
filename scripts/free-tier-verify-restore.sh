#!/usr/bin/env bash
# Restores a checked archive ONLY to an empty named LOCAL test database.
# Refuses remote connections and refuses any database other than the test DB.
set -Eeuo pipefail
umask 077
if [[ $# -ne 1 ]]; then
  echo "Usage: PGHOST=localhost PGDATABASE=scorecaster_archive_restore_test PGUSER=... bash scripts/free-tier-verify-restore.sh /secure/offline/archives/scorecaster-public-TIMESTAMP.dump" >&2
  exit 2
fi
if [[ -z "${PGHOST:-}" || -z "${PGDATABASE:-}" || -z "${PGUSER:-}" ]]; then
  echo "Explicit PGHOST+PGDATABASE+PGUSER are required for an isolated LOCAL restore." >&2
  exit 2
fi
if [[ -n "${PGSERVICE:-}" ]]; then
  echo "Unset PGSERVICE: verification must use explicit LOCAL connection settings." >&2
  exit 2
fi
if [[ "$PGDATABASE" != "scorecaster_archive_restore_test" ]]; then
  echo "Refusing restore outside the named test database." >&2
  exit 2
fi
for binary in pg_restore psql sha256sum; do
  command -v "$binary" >/dev/null || { echo "Missing program: $binary" >&2; exit 2; }
done
archive="$(realpath "$1")"
directory="$(dirname "$archive")"
name="$(basename "$archive")"
[[ "$name" =~ ^scorecaster-public-[0-9]{8}T[0-9]{6}Z\.dump$ ]] || {
  echo "Unexpected archive name; refusing to restore." >&2
  exit 2
}
stem="${name%.dump}"
[[ -f "$directory/${stem}.sha256" && -f "$directory/${stem}.counts.tsv" ]] || {
  echo "Missing archive checksum or original count manifest." >&2
  exit 2
}
(cd "$directory" && sha256sum --check "${stem}.sha256")
pg_restore --list "$archive" >/dev/null

db_info="$(psql --no-psqlrc -XAtq -v ON_ERROR_STOP=1 -c \
  "SELECT current_database() || '|' || COALESCE(host(inet_server_addr()), 'local') || '|' || (SELECT count(*) FROM pg_catalog.pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r','p','f'));")"
IFS='|' read -r db_name db_host existing_tables <<< "$db_info"
if [[ "$db_name" != "scorecaster_archive_restore_test" || "$existing_tables" != "0" ]]; then
  echo "Refusing non-empty or incorrectly named restore database." >&2
  exit 2
fi
case "$db_host" in
  local|127.*|::1) ;;
  *) echo "Refusing all REMOTE PostgreSQL restore destinations." >&2; exit 2;;
esac

# The clean flags are restricted to the verified empty LOCAL test database.
# They allow CREATE SCHEMA public from the archive where PG17 creates it by
# default. This NEVER points to production.
pg_restore --exit-on-error --single-transaction --clean --if-exists \
  --no-owner --no-acl --dbname="$PGDATABASE" "$archive"
while IFS=$'\t' read -r table expected; do
  [[ "$table" == "table" ]] && continue
  [[ "$table" =~ ^[a-z][a-z0-9_]*$ && "$expected" =~ ^[0-9]+$ ]] || {
    echo "Invalid counts manifest; refusing certification." >&2; exit 1;
  }
  actual="$(psql --no-psqlrc -XAtq -v ON_ERROR_STOP=1 \
    -c "SELECT count(*) FROM public.${table}")"
  [[ "$actual" == "$expected" ]] || {
    echo "RESTORE_NOT_VERIFIED: public.${table} row count differs from the source manifest." >&2; exit 1;
  }
done < "$directory/${stem}.counts.tsv"

echo "RESTORE_VERIFIED: archive checksums, PostgreSQL restore, and source row counts match."
echo "This is an archival safety check, NOT authorization to delete production history."
