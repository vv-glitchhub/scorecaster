import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  agentDecisionSigningConfigured,
  createAgentDecisionTicket,
  verifyAgentDecisionTicket
} from "../lib/agent-decision-ticket.mjs";

const key = "agent-ticket-test-key-that-is-longer-than-thirty-two-characters";

function decision(overrides = {}) {
  return {
    decision: "PLAY",
    match: "Home FC vs Away FC",
    selection: "Home FC",
    odds: 2.1,
    edge: 0.06,
    ev: 0.12,
    confidence: 0.8,
    trustScore: 80,
    bookmakerCount: 6,
    stressTest: {
      probability: 0.55,
      lower: 0.51,
      upper: 0.59,
      baseEv: 0.155,
      downsideEv: 0.071
    },
    evidence: ["Markkinakonsensus tukee valintaa."],
    counterArguments: ["Konsensus voi olla väärässä."],
    missingEvidence: ["vahvistettu kokoonpano"],
    suggestedStake: 8,
    ...overrides
  };
}

test("decision signing requires a dedicated sufficiently long key", () => {
  assert.equal(agentDecisionSigningConfigured("short"), false);
  assert.equal(agentDecisionSigningConfigured(key), true);
  assert.equal(createAgentDecisionTicket(decision(), { key: "short" }), null);
});

test("signed decision tickets preserve the sanitized immutable contract", () => {
  const now = Date.parse("2026-07-17T03:30:00Z");
  const ticket = createAgentDecisionTicket({
    ...decision(),
    email: "private@example.com",
    accessToken: "not-forwarded"
  }, { key, now, ttlMs: 600_000 });
  const verified = verifyAgentDecisionTicket(ticket, { key, now: now + 60_000 });

  assert.equal(verified.ok, true);
  assert.equal(verified.contract.decision, "PLAY");
  assert.equal(verified.contract.email, undefined);
  assert.equal(verified.contract.accessToken, undefined);
  assert.equal(verified.contract.selection, "Home FC");
  assert.equal(verified.expiresAt, now + 600_000);
});

test("tampered, expired and wrong-key decision tickets fail closed", () => {
  const now = Date.parse("2026-07-17T03:30:00Z");
  const ticket = createAgentDecisionTicket(decision(), { key, now, ttlMs: 60_000 });
  const tampered = `${ticket.slice(0, -1)}${ticket.endsWith("a") ? "b" : "a"}`;

  assert.equal(verifyAgentDecisionTicket(tampered, { key, now }).ok, false);
  assert.equal(verifyAgentDecisionTicket(ticket, { key: `${key}-wrong`, now }).ok, false);
  assert.equal(verifyAgentDecisionTicket(ticket, { key, now: now + 60_001 }).ok, false);
});

test("portfolio API is authenticated, rate-limited and signs only server-built decisions", async () => {
  const route = await readFile(new URL("../app/api/agent/portfolio/route.js", import.meta.url), "utf8");
  const authIndex = route.indexOf("getAuthenticatedContext(request)");
  const sourceIndex = route.indexOf("loadTopPicks(request, sports)");
  const portfolioIndex = route.indexOf("buildAgentV9Portfolio(source.payload?.data");
  const signingIndex = route.indexOf("createAgentDecisionTicket(decision)");

  assert.ok(authIndex >= 0);
  assert.ok(sourceIndex > authIndex);
  assert.ok(portfolioIndex > sourceIndex);
  assert.ok(signingIndex > portfolioIndex);
  assert.match(route, /bucket:\s*"agent_v10_portfolio"/);
  assert.match(route, /limit:\s*20/);
  assert.match(route, /windowSeconds:\s*300/);
  assert.match(route, /\.eq\("user_id", auth\.user\.id\)/);
  assert.match(route, /MAX_HISTORY\s*=\s*500/);
  assert.match(route, /MAX_SPORTS\s*=\s*6/);
});

test("enhanced explanation requires a verified signed ticket before provider use", async () => {
  const route = await readFile(new URL("../app/api/agent/explain/route.js", import.meta.url), "utf8");
  const authIndex = route.indexOf("const auth = await getAuthenticatedContext(request)");
  const verifyIndex = route.indexOf("const verified = verifyAgentDecisionTicket");
  const quotaIndex = route.indexOf("const limited = await enforceRateLimit(auth, requestId");
  const providerIndex = route.indexOf("const generated = await generateGroundedExplanation(contract)");

  assert.ok(authIndex >= 0);
  assert.ok(verifyIndex > authIndex);
  assert.ok(quotaIndex > verifyIndex);
  assert.ok(providerIndex > quotaIndex);
  assert.match(route, /Enhanced explanation requires a current server-signed Agent decision/);
  assert.match(route, /authoritative:\s*true/);
});

test("mobile Agent screen uses protected portfolio and explanation endpoints", async () => {
  const app = await readFile(new URL("../mobile/src/App.tsx", import.meta.url), "utf8");
  const screen = await readFile(new URL("../mobile/src/screens/AgentScreen.tsx", import.meta.url), "utf8");

  assert.match(app, /key:\s*"agent"/);
  assert.match(app, /<AgentScreen\s*\/>/);
  assert.match(screen, /"\/api\/agent\/portfolio"/);
  assert.match(screen, /"\/api\/agent\/explain"/);
  assert.match(screen, /ticket:\s*decision\.explanationTicket/);
  assert.match(screen, /"\/api\/cloud\/bets"/);
  assert.match(screen, /scorecaster-mobile-agent-v10/);
});
