import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

async function source(relativePath) {
  try {
    return await readFile(path.join(root, relativePath), "utf8");
  } catch {
    failures.push(`Missing required public-schema hardening file: ${relativePath}`);
    return "";
  }
}

function requireMatch(text, pattern, message) {
  if (!pattern.test(text)) failures.push(message);
}

function executableSql(sql) {
  return sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

const [apply, verify, regression, docs, workflow] = await Promise.all([
  source("scripts/apply-public-schema-hardening-v1.sql"),
  source("scripts/verify-public-schema-hardening-v1.sql"),
  source("scripts/public-schema-hardening.test.mjs"),
  source("docs/PUBLIC_SCHEMA_HARDENING_V1.md"),
  source(".github/workflows/public-schema-hardening.yml")
]);

requireMatch(apply, /begin;/i, "Public-schema hardening must run in a transaction");
requireMatch(apply, /commit;/i, "Public-schema hardening must commit explicitly");
requireMatch(apply, /enable row level security/i, "Public-schema hardening must enable RLS");
requireMatch(apply, /force row level security/i, "Public-schema hardening must force RLS on reviewed tables");
requireMatch(apply, /revoke all privileges .* from public, anon, authenticated/i, "Public-schema hardening must revoke browser grants before restoring reviewed access");
requireMatch(apply, /grant all privileges .* to service_role/i, "Public-schema hardening must preserve service-role table access");
requireMatch(apply, /pg_policies/i, "Reviewed client grants must be backed by existing RLS policies");
requireMatch(apply, /Public schema hardening refused:/i, "Missing policy support must fail the hardening transaction closed");
requireMatch(apply, /grant select, insert, update, delete on table public\.bets to authenticated/i, "bets must keep the reviewed authenticated CRUD matrix");
requireMatch(apply, /grant select, insert, update on table public\.user_settings to authenticated/i, "user_settings must keep only the reviewed authenticated read/write matrix");
requireMatch(apply, /grant select on table public\.community_comments to anon, authenticated/i, "Community Feed must keep the reviewed public-read matrix");
requireMatch(apply, /grant insert, update, delete on table public\.community_comments to authenticated/i, "Community Feed writes must remain authenticated");

const executable = executableSql(apply);
if (/drop\s+(table|column)|truncate\s+table|delete\s+from/i.test(executable)) {
  failures.push("Public-schema hardening contains a destructive table/row operation");
}
if (/grant\s+(truncate|trigger|references)/i.test(executable)) {
  failures.push("Public-schema hardening restores a dangerous browser privilege");
}

for (const token of [
  "relrowsecurity",
  "relforcerowsecurity",
  "PUBLIC table privileges remain",
  "Dangerous client grants remain",
  "Internal relations still expose client privileges",
  "service_role access is incomplete",
  "grant lacks RLS policy backing",
  "public-schema-hardening-v1.2",
  "reviewedClientGrantsPolicyBacked",
  "paperOnly"
]) {
  if (!verify.includes(token)) failures.push(`Public-schema verification is missing invariant: ${token}`);
}

if (!regression.includes("public-schema-hardening-v1")) failures.push("Public-schema hardening regression suite is not version-aware");
if (!docs.includes("production Supabase") || !docs.includes("production evidence")) failures.push("Public-schema hardening documentation must describe production apply/evidence");
if (!workflow.includes("scripts/public-schema-hardening.test.mjs")) failures.push("Public-schema hardening workflow must run its regression suite");

if (failures.length) {
  console.error("\nScorecaster public-schema release gate failed:\n");
  failures.forEach((message) => console.error(`- ${message}`));
  process.exitCode = 1;
} else {
  console.log("Scorecaster public-schema repository gate passed: policy-backed client grants, service-role preservation, verification SQL and non-destructive migration are present.");
  console.log("External verification still required: apply the hardening SQL in production Supabase, run the read-only verification SQL and retain its JSON result before production activation.");
}
