import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("Agent portfolio resolves the signing key inside the serverless request before creating tickets", async () => {
  const route = await source("app/api/agent/portfolio/route.js");
  assert.match(route, /resolveAgentDecisionSigningKey/);
  assert.match(route, /await Promise\.all\([\s\S]*resolveAgentDecisionSigningKey\(\)/);
  assert.match(route, /createAgentDecisionTicket\(evidence\.signedDecision, \{ key: signing\.key \}\)/);
  assert.match(route, /signingConfigured = signing\.configured === true && Boolean\(signing\.key\)/);
});

test("Agent explanation resolves the signing key inside the serverless request before verification", async () => {
  const route = await source("app/api/agent/explain/route.js");
  assert.match(route, /const signing = await resolveAgentDecisionSigningKey\(\)/);
  assert.match(route, /verifyAgentDecisionTicket\(body\.data\?\.ticket, \{ key: signing\.key \}\)/);
});

test("health reports request-scoped signing readiness instead of env-only startup state", async () => {
  const route = await source("app/api/health/route.js");
  assert.match(route, /agentDecisionSigningReadiness/);
  assert.match(route, /const agentDecisionSigning = await agentDecisionSigningReadiness\(\)/);
  assert.match(route, /agentV10DecisionSigningConfigured: agentDecisionSigning\.configured/);
  assert.doesNotMatch(
    route,
    /agentV10DecisionSigningConfigured:\s*Boolean\(\s*process\.env\.AGENT_DECISION_SIGNING_KEY/
  );
});

test("Vault resolver remains server-only, cached and fail-closed", async () => {
  const resolver = await source("lib/agent-decision-signing-key.mjs");
  assert.match(resolver, /getSupabaseAdmin/);
  assert.match(resolver, /scorecaster_agent_decision_signing_key/);
  assert.match(resolver, /AGENT_DECISION_SIGNING_CACHE_MS = 5 \* 60 \* 1000/);
  assert.match(resolver, /return \{ configured: false, key: null, source: "unconfigured" \}/);
  assert.doesNotMatch(resolver, /NEXT_PUBLIC_.*SIGNING/i);
});
