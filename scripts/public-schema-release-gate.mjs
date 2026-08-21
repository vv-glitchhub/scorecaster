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

const [apply, verify, regression, docs, workflow, rateLimitSql, apiSecurity] = await Promise.all([
  source("scripts/apply-public-schema-hardening-v1.sql"),
  source("scripts/verify-public-schema-hardening-v1.sql"),
  source("scripts/public-schema-hardening.test.mjs"),
  source("docs/PUBLIC_SCHEMA_HARDENING_V1.md"),
  source(".github/workflows/public-schema-hardening.yml"),
  source("supabase/scorecaster_api_rate_limits.sql"),
  source("lib/api-security.js")
]);

requireMatch(apply, /public-schema hardening V1\.3/i, "Public-schema hardening apply patch must identify V1.3");
requireMatch(apply, /begin;/i, "Public-schema hardening must run in a transaction");
requireMatch(apply, /commit;/i, "Public-schema hardening must commit explicitly");
requireMatch(apply, /enable row level security/i, "Public-schema hardening must enable RLS");
requireMatch(apply, /force row level security/i, "Public-schema hardening must force RLS on reviewed tables");
requireMatch(apply, /revoke truncate, references, trigger .* from anon, authenticated/i, "V1.3 must globally remove database-owner style browser privileges");
requireMatch(apply, /revoke all privileges .* from public, anon, authenticated/i, "Public-schema hardening must revoke browser grants before restoring reviewed access");
requireMatch(apply, /grant all privileges .* to service_role/i, "Public-schema hardening must preserve service-role table access");
requireMatch(apply, /pg_policies/i, "Reviewed client grants must be backed by existing RLS policies");
requireMatch(apply, /Public schema hardening refused:/i, "Missing policy support must fail the hardening transaction closed");
requireMatch(apply, /grant select, update on table public\.profiles to authenticated/i, "profiles must keep only authenticated SELECT+UPDATE");
requireMatch(apply, /drop policy if exists "Users insert own profile"/i, "legacy direct profile INSERT policy must be removed");
requireMatch(apply, /bet_slips.*bet_slip_items.*tracked_bets.*pick_explanations.*agent_feedback.*risk_events/s, "legacy user-owned tables must be reviewed together");
requireMatch(apply, /grant select, insert, update, delete on table public\.bets to authenticated/i, "bets must keep the reviewed authenticated CRUD matrix");
requireMatch(apply, /grant select, insert, update on table public\.user_settings to authenticated/i, "user_settings must keep only the reviewed authenticated read/write matrix");
requireMatch(apply, /grant select on table public\.community_comments to anon, authenticated/i, "Community Feed must keep the reviewed public-read matrix");
requireMatch(apply, /grant insert, update, delete on table public\.community_comments to authenticated/i, "Community Feed writes must remain authenticated");
requireMatch(apply, /where n\.nspname = 'public'\s+and p\.prosecdef/s, "V1.3 must enumerate current public SECURITY DEFINER functions");
requireMatch(apply, /grant execute on function %s to service_role/i, "SECURITY DEFINER functions must default to service_role execution");
for (const rpc of [
  /claim_notification_device\(text, text, text, text\).*authenticated/s,
  /request_autonomous_agent_run\(\).*authenticated/s
]) requireMatch(apply, rpc, "Reviewed authenticated SECURITY DEFINER RPC allowlist is incomplete");

requireMatch(rateLimitSql, /drop function if exists public\.consume_api_quota\(text, integer, integer\)/i, "Legacy client-callable quota RPC must be retired");
requireMatch(rateLimitSql, /create or replace function public\.consume_api_quota_for_user/i, "Server-owned quota RPC must exist");
requireMatch(rateLimitSql, /revoke all on function public\.consume_api_quota_for_user\([^;]+\) from authenticated/i, "Authenticated users must not execute server-owned quota RPC");
requireMatch(rateLimitSql, /grant execute on function public\.consume_api_quota_for_user\([^;]+\) to service_role/i, "service_role must execute server-owned quota RPC");
requireMatch(apiSecurity, /getSupabaseAdmin/), "API security must use the server admin client for quota mutation";
requireMatch(apiSecurity, /rpc\("consume_api_quota_for_user"/), "API security must call the server-owned quota RPC";
requireMatch(apiSecurity, /p_user_id:\s*auth\.user\.id/), "API security must bind quota mutation to the verified user id";

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
  "Policyless RLS tables still expose client privileges",
  "Internal relations still expose client privileges",
  "service_role access is incomplete",
  "legacy Users insert own profile policy remains",
  "Anonymous SECURITY DEFINER execution remains",
  "Unexpected authenticated SECURITY DEFINER execution remains",
  "Legacy authenticated quota RPC still exists",
  "Authenticated users can execute server-owned quota RPC",
  "public-schema-hardening-v1.4",
  "reviewedClientGrantsPolicyBacked",
  "apiQuotaMutation",
  "paperOnly"
]) {
  if (!verify.includes(token)) failures.push(`Public-schema verification is missing invariant: ${token}`);
}

if (!regression.includes("public-schema-hardening-v1.4")) failures.push("Public-schema hardening regression suite is not V1.4-aware");
if (!regression.includes("SECURITY DEFINER")) failures.push("Public-schema hardening regression suite must cover SECURITY DEFINER execution");
if (!docs.includes("production Supabase") || !docs.includes("production evidence")) failures.push("Public-schema hardening documentation must describe production apply/evidence");
if (!workflow.includes("scripts/public-schema-hardening.test.mjs")) failures.push("Public-schema hardening workflow must run its regression suite");

if (failures.length) {
  console.error("\nScorecaster public-schema release gate failed:\n");
  failures.forEach((message) => console.error(`- ${message}`));
  process.exitCode = 1;
} else {
  console.log("Scorecaster public-schema V1.4 repository gate passed: policy-backed client grants, global dangerous-grant removal, server-owned quota mutation, SECURITY DEFINER allowlisting, service-role preservation and verification SQL are present.");
  console.log("External verification still required: deploy the matching server code, apply the exact rate-limit/public-schema SQL in production Supabase, run the read-only verification SQL, rerun Supabase security advisors and retain non-secret production evidence before production activation.");
}
