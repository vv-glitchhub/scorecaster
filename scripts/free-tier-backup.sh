#!/usr/bin/env bash
# Explicit, read-only archive creation on a trusted computer.
# This never deletes, truncates, alters, migrates, or uploads production data.
set -Eeuo pipefail
umask 077

if [[ $# -ne 1 ]]; then
  echo "Usage: PGHOST=... PGDATABASE=... PGUSER=... (with secure PGPASSFILE) bash scripts/free-tier-backup.sh /secure/offline/archives" >&2
  exit 2
fi
if [[ -z "${PGSERVICE:-}" && ( -z "${PGHOST:-}" || -z "${PGDATABASE:-}" || -z "${PGUSER:-}" ) ]]; then
  echo "Set PGSERVICE or PGHOST+PGDATABASE+PGUSER; use a secure PGPASSFILE for credentials." >&2
  exit 2
fi
for binary in pg_dump pg_restore psql sha256sum date; do
  command -v "$binary" >/dev/null || { echo "Missing required program: $binary" >&2; exit 2; }
done

source_check="$(psql --no-psqlrc -XAtq -v ON_ERROR_STOP=1 -c \
  "SELECT CASE WHEN to_regclass('public.market_provider_snapshots_v2') IS NOT NULL AND to_regclass('public.sports_analytics_observations') IS NOT NULL AND to_regclass('public.scorecaster_own_decisions_v1') IS NOT NULL THEN 'scorecaster' ELSE 'wrong-database' END")"
if [[ "$source_check" != "scorecaster" ]]; then
  echo "Refusing to archive a database without required Scorecaster history tables." >&2
  exit 2
fi

destination="$(realpath -m "$1")"
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -n "$repo_root" && ( "$destination" == "$repo_root" || "$destination" == "$repo_root/"* ) ]]; then
  echo "Refusing to write a database archive inside the Git repository." >&2
  exit 2
fi

mkdir -p "$destination"
chmod 700 "$destination"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
prefix="scorecaster-public-${stamp}"
archive="$destination/${prefix}.dump"
partial="$archive.partial"
inventory="$destination/${prefix}.toc"
counts="$destination/${prefix}.counts.tsv"
checksum="$destination/${prefix}.sha256"
for file in "$archive" "$partial" "$inventory" "$counts" "$checksum"; do
  [[ ! -e "$file" ]] || { echo "Refusing to overwrite existing archive material." >&2; exit 2; }
done

trap 'if [[ -f "$partial" ]]; then rm -f -- "$partial"; fi' EXIT
# Full public schema + data, including constraints, historical odds and models.
# Supabase-managed auth/storage schemas are NOT contained in this archive.
pg_dump \
  --format=custom --compress=9 --no-owner --no-acl \
  --schema=public --file="$partial"

pg_restore --list "$partial" > "$inventory"
for table in market_provider_snapshots_v2 sports_analytics_observations \
             scorecaster_model_predictions_v1 scorecaster_own_decisions_v1 \
             unified_data_snapshots; do
  if ! grep -Eq "TABLE DATA public ${table}([[:space:]]|$)" "$inventory"; then
    echo "Archive verification failed: missing public.${table} data entry." >&2
    exit 1
  fi
done

# Read-only counts are independently checked after export. Pause all producers
# during the export; if the source changes, the counts can differ and a later
# restore verification MUST fail closed before any retention operation.
printf "table\trows\n" > "$counts"
for table in market_provider_snapshots_v2 sports_analytics_observations \
             scorecaster_model_predictions_v1 scorecaster_own_decisions_v1 \
             unified_data_snapshots scorecaster_canonical_facts_v1 \
             unified_data_provider_observations sports_analytics_snapshots; do
  rowcount="$(psql --no-psqlrc -XAtq \
    -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM public.${table}")"
  [[ "$rowcount" =~ ^[0-9]+$ ]] || { echo "Invalid source row count." >&2; exit 1; }
  printf "%s\t%s\n" "$table" "$rowcount" >> "$counts"
done

mv "$partial" "$archive"
(
  cd "$destination"
  sha256sum "$(basename "$archive")" "$(basename "$inventory")" "$(basename "$counts")" > "$(basename "$checksum")"
)
chmod 600 "$archive" "$inventory" "$counts" "$checksum"
trap - EXIT
echo "ARCHIVE_CREATED: $archive"
echo "INTEGRITY_LIST: $checksum"
echo "NEXT: Verify by restoring to an isolated local test database; checksums alone are insufficient."
echo "IMPORTANT: Protect this directory with encryption and a separate offline copy. Nothing has been deleted."
