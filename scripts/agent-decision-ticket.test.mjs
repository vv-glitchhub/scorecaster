import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  agentDecisionSigningConfigured,
  createAgentDecisionTicket,
  verifyAgentDecisionTicket
} from "../lib/agent-decision-ticket.mjs";
import { buildDecisionEvidenceContractV1 } from "../lib/decision-evidence-contract-v1.mjs";
import {
  buildDecisionEvidenceSealV1,
  DECISION_EVIDENCE_SEAL_VERSION
} from "../lib/decision-evidence-seal-v1.mjs";

const key = "agent-ticket-test-key-that-is-longer-than-thirty-two-characters";

function decision(overrides = {}) {
  return {
    gameId: "event-1",
    decision: "PLAY",
    productDecision: "PLAY",
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
    dataGate: {
      bookmakerCount: 6,
      confidence: 0.8,
      freshness: "fresh",
      stale: false,
      playable: true,
      watchable: true
    },
    evidence: ["Markkinakonsensus tukee valintaa."],
    counterArguments: ["Konsensus voi olla väärässä."],
    missingEvidence: ["vahvistettu kokoonpano"],
    suggestedStake: 8,
    ...overrides
  };
}

function sealedDecision(overrides = {}) {
  const source = decision(overrides);
  const seal = buildDecisionEvidenceSealV1(buildDecisionEvidenceContractV1(source));
  assert.ok(seal);
  return {
    ...source,
    decisionEvidenceSeal: seal
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
  assert.equal(verified.contract.language, undefined);
  assert.equal(verified.expiresAt, now + 600_000);
});

test("structured Decision Evidence seal becomes part of the signed explanation contract", () => {
  const now = Date.parse("2026-08-14T06:45:00Z");
  const source = sealedDecision();
  const ticket = createAgentDecisionTicket(source, { key, now, ttlMs: 600_000 });
  const verified = verifyAgentDecisionTicket(ticket, { key, now: now + 1_000 });

  assert.equal(verified.ok, true);
  assert.equal(
    verified.contract.decisionEvidenceSeal.contractFingerprint,
    source.decisionEvidenceSeal.contractFingerprint
  );
  assert.equal(
    verified.contract.decisionEvidenceSeal.sealFingerprint,
    source.decisionEvidenceSeal.sealFingerprint
  );
  assert.equal(verified.contract.decisionEvidenceSeal.version, DECISION_EVIDENCE_SEAL_VERSION);
  assert.match(verified.contract.evidence.join(" "), new RegExp(source.decisionEvidenceSeal.contractFingerprint));
  assert.match(verified.contract.evidence.join(" "), /Context cannot upgrade/);
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
  const authIndex = route.indexOf("const auth = await getAuthenticatedContext(request)");
  const sourceIndex = route.indexOf("const [source, learningResult] = await Promise.all");
  const portfolioIndex = route.indexOf("buildAgentV9Portfolio(source.payload?.data");
  const governanceIndex = route.indexOf("applyModelLabSafety(portfolio.decisions");
  const evidenceIndex = route.indexOf("signedDecisionEvidence(decision)");
  const signingIndex = route.indexOf("createAgentDecisionTicket(evidence.signedDecision)");

  assert.ok(authIndex >= 0);
  assert.ok(sourceIndex > authIndex);
  assert.ok(portfolioIndex > sourceIndex);
  assert.ok(governanceIndex > portfolioIndex);
  assert.ok(evidenceIndex > governanceIndex);
  assert.ok(signingIndex > evidenceIndex);
  assert.match(route, /buildDecisionEvidenceContractV1\(decision\)/);
  assert.match(route, /buildDecisionEvidenceSealV1\(contract\)/);
  assert.match(route, /decisionEvidenceSeal:\s*seal/);
  assert.match(route, /decisionEvidenceVersion:\s*evidence\.contract\.version/);
  assert.match(route, /decisionEvidenceFingerprint:\s*evidence\.contract\.fingerprint/);
  assert.match(route, /decisionEvidenceSeal:\s*evidence\.seal/);
  assert.match(route, /decisionEvidenceMode:\s*"signed-structured-seal-v1"/);
  assert.match(route, /bucket:\s*"agent_v11_portfolio"/);
  assert.match(route, /limit:\s*20/);
  assert.match(route, /windowSeconds:\s*300/);
  assert.match(route, /\.eq\("user_id", auth\.user\.id\)/);
  assert.match(route, /MAX_HISTORY\s*=\s*500/);
  assert.match(route, /MAX_SPORTS\s*=\s*6/);
  assert.match(route, /buildSelfLearningReport\(history\)/);
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
  assert.match(route, /verified\.contract\.decisionEvidenceSeal/);
  assert.match(route, /Enhanced explanation requires a current server-signed structured Decision Evidence seal/);
  assert.match(route, /decisionEvidenceSealFingerprint/);
  assert.match(route, /authoritative:\s*true/);
  assert.doesNotMatch(route, /contract\.language/);
});

test("mobile Agent screen uses protected portfolio, model lab and explanation endpoints", async () => {
  const app = await readFile(new URL("../mobile/src/App.tsx", import.meta.url), "utf8");
  const screen = await readFile(new URL("../mobile/src/screens/AgentScreen.tsx", import.meta.url), "utf8");

  assert.match(app, /key:\s*"agent"/);
  assert.match(app, /<AgentScreen\s*\/>/);
  assert.match(screen, /"\/api\/agent\/portfolio"/);
  assert.match(screen, /"\/api\/agent\/explain"/);
  assert.match(screen, /ticket:\s*decision\.explanationTicket \|\| null, language/);
  assert.match(screen, /"\/api\/cloud\/bets"/);
  assert.match(screen, /scorecaster-mobile-agent-v11/);
  assert.match(screen, /portfolio\?\.modelLab/);
});