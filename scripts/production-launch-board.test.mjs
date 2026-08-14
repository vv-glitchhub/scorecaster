import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
async function source(path) { return readFile(new URL(path, root), "utf8"); }

test("production launch board separates critical gates from optional diagnostics", async () => {
  const client = await source("app/production-status/production-status-client.jsx");
  assert.match(client, /Production Launch Board/);
  assert.match(client, /services\.supabaseConfigured === true/);
  assert.match(client, /services\.oddsApiConfigured === true/);
  assert.match(client, /services\.settlementMonitorWorkerActive === true/);
  assert.match(client, /services\.autonomousAgentWorkerActive === true/);
  assert.match(client, /services\.realMoneyBetting === false && services\.autonomousAgentPaperOnly === true/);
  assert.match(client, /readyCount === launchChecks\.length/);
  assert.match(client, /Käynnistä 1 000 € paperiautomatiikka/);
  assert.match(client, /agentV10DecisionSigningConfigured/);
  assert.match(client, /Production hardening/);
  assert.match(client, /not every flag is a launch blocker/);
  assert.match(client, /href="\/api\/health"/);
  assert.doesNotMatch(client, /SUPABASE_SERVICE_ROLE_KEY|CRON_SECRET|ODDS_API_KEY|AGENT_DECISION_SIGNING_KEY\s*[:=]/);
});

test("launch board remains trilingual and keeps user activation behind the autonomous console", async () => {
  const client = await source("app/production-status/production-status-client.jsx");
  assert.match(client, /useLanguage/);
  assert.match(client, /fi:/);
  assert.match(client, /en:/);
  assert.match(client, /es:/);
  assert.match(client, /href: "\/autonomous-agent"/);
  assert.match(client, /Per-user opt-in/);
  assert.doesNotMatch(client, /method:\s*["']PUT["']|method:\s*["']POST["']/);
});

test("personal launch readiness reads authenticated autonomous state without mutating it", async () => {
  const page = await source("app/production-status/page.jsx");
  const personal = await source("app/production-status/PersonalLaunchStatus.jsx");
  assert.match(page, /<PersonalLaunchStatus \/>/);
  assert.match(personal, /fetch\("\/api\/cloud\/autonomous-agent"/);
  assert.match(personal, /response\.status === 401 \|\| response\.status === 403/);
  assert.match(personal, /settings\.enabled === true/);
  assert.match(personal, /readiness\.ready === true/);
  assert.match(personal, /bankroll\?\.bankroll/);
  assert.match(personal, /paper_trading_mode/);
  assert.match(personal, /state\?\.last_status/);
  assert.match(personal, /state\?\.last_saved_count/);
  assert.match(personal, /state\?\.next_check_at/);
  assert.match(personal, /OPT-IN REQUIRED/);
  assert.match(personal, /No user-specific blockers/);
  assert.doesNotMatch(personal, /method:\s*["'](?:PUT|POST|PATCH|DELETE)["']/);
  assert.doesNotMatch(personal, /SUPABASE_SERVICE_ROLE_KEY|CRON_SECRET|ODDS_API_KEY|AGENT_DECISION_SIGNING_KEY/);
});

test("personal launch readiness preserves auth and paper-only navigation boundaries", async () => {
  const personal = await source("app/production-status/PersonalLaunchStatus.jsx");
  assert.match(personal, /href="\/login"/);
  assert.match(personal, /href="\/autonomous-agent"/);
  assert.match(personal, /href="\/tracking"/);
  assert.match(personal, /Personal launch readiness/);
  assert.match(personal, /Virtuaalikassa/);
  assert.match(personal, /Paper mode/);
  assert.match(personal, /fi:/);
  assert.match(personal, /en:/);
  assert.match(personal, /es:/);
});
