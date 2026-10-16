import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const source = (file) => readFile(new URL(file, root), "utf8");

test("archive shell scripts pass Bash syntax without executing database commands", async () => {
  for (const file of ["scripts/free-tier-backup.sh", "scripts/free-tier-verify-restore.sh"]) {
    execFileSync("bash", ["-n", new URL(file, root).pathname], { stdio: "pipe" });
  }
});

test("public-schema archive is private, export-only, and fails closed on incomplete data", async () => {
  const script = await source("scripts/free-tier-backup.sh");
  assert.match(script, /umask 077/);
  assert.match(script, /pg_dump .*--dbname=/);
  assert.match(script, /--schema=public/);
  assert.match(script, /--format=custom --compress=9/);
  assert.match(script, /pg_restore --list/);
  assert.match(script, /sha256sum/);
  assert.match(script, /Refusing to write a database archive inside the Git repository/);
  assert.match(script, /SCORECASTER_ARCHIVE_DATABASE_URL/);
  assert.doesNotMatch(script, /\b(?:DELETE\s+FROM|TRUNCATE\s+TABLE|DROP\s+TABLE)\b/i);
  assert.doesNotMatch(script, /(?:github\.com|curl .*upload|upload-artifact|aws s3|rsync .*@)/i);
});

test("restore check only targets an empty local test DB and checks physical counts", async () => {
  const script = await source("scripts/free-tier-verify-restore.sh");
  assert.match(script, /scorecaster_archive_restore_test/);
  assert.match(script, /Refusing all REMOTE PostgreSQL restore destinations/);
  assert.match(script, /existing_tables/);
  assert.match(script, /sha256sum --check/);
  assert.match(script, /--single-transaction --clean --if-exists/);
  assert.match(script, /RESTORE_VERIFIED/);
  assert.match(script, /row count differs/);
  assert.doesNotMatch(script, /SCORECASTER_ARCHIVE_DATABASE_URL/);
});

test("market history is throttled without changing Top Picks, and retention does not run automatically", async () => {
  const worker = await source("app/api/internal/market-microstructure/route.js");
  const flow = await source(".github/workflows/market-microstructure.yml");
  const policy = await source("lib/free-tier-market-capture.mjs");
  assert.match(flow, /cron: "17 \*\/3 \* \* \*"/);
  assert.match(policy, /maxEventsPerCycle: 12/);
  assert.match(policy, /maxBookmakersPerEvent: 4/);
  assert.match(worker, /storagePlan = selectFreeTierMarketCapture/);
  assert.match(worker, /historicalDataDeleted: false/);
  assert.doesNotMatch(worker, /\b(?:\.delete\(\)|\.truncate\(|DROP TABLE|TRUNCATE TABLE)\b/);
});
