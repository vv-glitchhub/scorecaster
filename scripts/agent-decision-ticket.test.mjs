import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createAgentDecisionTicket,
  signingConfigured,
  verifyAgentDecisionTicket
} from "../lib/agent-decision-ticket.mjs";
import { canonicalAgentExplanationInput, sanitizeAgentExplanationInput } from "../lib/agent-v10-explanation.mjs";

const originalKey = process.env.AGENT_DECISION_SIGNING_KEY;

function restoreKey() {
  if (originalKey === undefined) delete process.env.AGENT_DECISION_SIGNING_KEY;
  else process.env.AGENT_DECISION_SIGNING_KEY = originalKey;
}

test.afterEach(restoreKey);

test("decision signing requires a dedicated sufficiently long key", () => {
  delete process.env.AGENT_DECISION_SIGNING_KEY;
  assert.equal(signingConfigured(), false);
  assert.equal(createAgentDecisionTicket({ decision: "PLAY" }), null);

  process.env.AGENT_DECISION_SIGNING_KEY = "short";
  assert.equal(signingConfigured(), false);

  process.env.AGENT_DECISION_SIGNING_KEY = "scorecaster-agent-signing-key-for-tests-only-123456";
  assert.equal(signingConfigured(), true);
});

test("signed decision tickets preserve the sanitized immutable contract", () => {
  process.env.AGENT_DECISION_SIGNING_KEY = "scorecaster-agent-signing-key-for-tests-only-123456";
  const source = {
    decision: "WATCH",
    match: "Alpha vs Beta",
    selection: "Alpha",
    odds: 2.1,
    evidence: ["Verified evidence"],
    counterArguments: ["Strong counterpoint"],
    missingEvidence: ["latest market data"],
    email: "private@example.com"
  };
  const expected = sanitizeAgentExplanationInput(source);
  const signed = createAgentDecisionTicket(source, { now: 1000, ttlMs: 60000 });
  assert.ok(signed?.token);
  const verified = verifyAgentDecisionTicket(signed.token, { now: 2000 });
  assert.equal(verified.ok, true);
  assert.equal(canonicalAgentExplanationInput(verified.contract), canonicalAgentExplanationInput(expected));
  assert.equal("email" in verified.contract, false);
});

test("tampered, expired and wrong-key decision tickets fail closed", () => {
  process.env.AGENT_DECISION_SIGNING_KEY = "scorecaster-agent-signing-key-for-tests-only-123456";
  const signed = createAgentDecisionTicket({ decision: "SKIP", match: "A vs B", selection: "B" }, { now: 1000, ttlMs: 1000 });
  assert.ok(signed?.token);

  const [payload, signature] = signed.token.split(".");
  const tampered = `${payload.slice(0, -1)}${payload.endsWith("A") ? "B" : "A"}.${signature}`;
  assert.equal(verifyAgentDecisionTicket(tampered, { now: 1500 }).ok, false);
  assert.equal(verifyAgentDecisionTicket(signed.token, { now: 3000 }).ok, false);

  process.env.AGENT_DECISION_SIGNING_KEY = "different-agent-signing-key-for-tests-only-654321";
  assert.equal(verifyAgentDecisionTicket(signed.token, { now: 1500 }).ok, false);
});

test("portfolio API is authenticated, rate-limited and signs only server-built decisions", async () => {
  const route = await readFile(new URL("../app/api/agent/portfolio/route.js", import.meta.url), "utf8");
  const authIndex = route.indexOf("const auth = await getAuthenticatedContext(request)");
  const sourceIndex = route.indexOf("const source = await loadSourcePicks");
  const portfolioIndex = route.indexOf("const portfolio = buildAgentV9Portfolio");
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
  const providerIndex = route.indexOf("const generated = await generateGroundedExplanation(contract, language)");

  assert.ok(authIndex >= 0);
  assert.ok(verifyIndex > authIndex);
  assert.ok(quotaIndex > verifyIndex);
  assert.ok(providerIndex > quotaIndex);
  assert.match(route, /Enhanced explanation requires a current server-signed Agent decision/);
  assert.match(route, /authoritative:\s*true/);
  assert.doesNotMatch(route, /contract\.language/);
});

test("mobile Agent screen uses protected portfolio and explanation endpoints", async () => {
  const app = await readFile(new URL("../mobile/src/App.tsx", import.meta.url), "utf8");
  const screen = await readFile(new URL("../mobile/src/screens/AgentScreen.tsx", import.meta.url), "utf8");

  assert.match(app, /key:\s*"agent"/);
  assert.match(app, /<AgentScreen\s*\/>/);
  assert.match(screen, /"\/api\/agent\/portfolio"/);
  assert.match(screen, /"\/api\/agent\/explain"/);
  assert.match(screen, /ticket:\s*decision\.explanationTicket \|\| null, language/);
  assert.match(screen, /"\/api\/cloud\/bets"/);
  assert.match(screen, /scorecaster-mobile-agent-v10/);
});
