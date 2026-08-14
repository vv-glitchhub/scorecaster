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
