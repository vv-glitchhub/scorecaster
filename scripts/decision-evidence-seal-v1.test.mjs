import test from "node:test";
import assert from "node:assert/strict";
import { buildDecisionEvidenceContractV1 } from "../lib/decision-evidence-contract-v1.mjs";
import {
  buildDecisionEvidenceSealV1,
  decisionEvidenceBoundaryText,
  sanitizeDecisionEvidenceSealV1,
  DECISION_EVIDENCE_SEAL_VERSION
} from "../lib/decision-evidence-seal-v1.mjs";
import { sanitizeAgentExplanationInput } from "../lib/agent-v10-explanation.mjs";

function pick(overrides = {}) {
  return {
    gameId: "event-1",
    decision: "PLAY",
    productDecision: "PLAY",
    selection: "Home",
    match: "Home vs Away",
    bookmaker: "Example Book",
    odds: 2.05,
    edge: 0.02,
    ev: 0.04,
    confidence: 0.72,
    fixtureVerifiedByProvider: true,
    fixtureSource: "live-odds-provider",
    dataGate: {
      bookmakerCount: 6,
      confidence: 0.72,
      freshness: "fresh",
      stale: false,
      playable: true,
      watchable: true
    },
    sportsIntelligence: {
      readiness: { level: "verified", verifiedCount: 3, totalChecks: 3, missing: [] },
      sourceCount: 2,
      conflicts: []
    },
    featureEngineV1: { snapshotHash: "feature-hash", counts: { total: 4, eligible: 3 }, eligibilityRate: 0.75 },
    ensembleEngineV1: { counts: { researchEligible: 2, calibrationReady: 0 }, models: [] },
    ...overrides
  };
}

test("Decision Evidence Seal V1 is deterministic and binds the evidence contract", () => {
  const contract = buildDecisionEvidenceContractV1(pick());
  const first = buildDecisionEvidenceSealV1(contract);
  const second = buildDecisionEvidenceSealV1(contract);

  assert.ok(first);
  assert.deepEqual(first, second);
  assert.equal(first.version, DECISION_EVIDENCE_SEAL_VERSION);
  assert.equal(first.contractVersion, contract.version);
  assert.equal(first.contractFingerprint, contract.fingerprint);
  assert.equal(first.eventId, "event-1");
  assert.equal(first.selection, "Home");
  assert.equal(first.productDecision, "PLAY");
  assert.match(first.sealFingerprint, /^[a-f0-9]{64}$/);
  assert.deepEqual(first.boundaries, {
    productionProbabilityChangedByResearch: false,
    productionDecisionChangedByResearch: false,
    contextCanUpgrade: false,
    automaticModelPromotionAllowed: false,
    paperOnly: true,
    realMoneyActionAvailable: false
  });
});

test("seal validation fails closed on tampering or changed safety boundaries", () => {
  const seal = buildDecisionEvidenceSealV1(buildDecisionEvidenceContractV1(pick()));
  assert.ok(seal);
  assert.equal(sanitizeDecisionEvidenceSealV1({ ...seal, contractFingerprint: "a".repeat(64) }), null);
  assert.equal(sanitizeDecisionEvidenceSealV1({
    ...seal,
    boundaries: { ...seal.boundaries, contextCanUpgrade: true }
  }), null);
  assert.equal(decisionEvidenceBoundaryText({ ...seal, sealFingerprint: "b".repeat(64) }), "");
});

test("seal validation binds event, selection and product decision to the Agent contract", () => {
  const seal = buildDecisionEvidenceSealV1(buildDecisionEvidenceContractV1(pick()));
  assert.ok(sanitizeDecisionEvidenceSealV1(seal, {
    eventId: "event-1",
    selection: "Home",
    decision: "PLAY"
  }));
  assert.equal(sanitizeDecisionEvidenceSealV1(seal, { eventId: "event-2" }), null);
  assert.equal(sanitizeDecisionEvidenceSealV1(seal, { selection: "Away" }), null);
  assert.equal(sanitizeDecisionEvidenceSealV1(seal, { decision: "SKIP" }), null);

  const cautionSeal = buildDecisionEvidenceSealV1(buildDecisionEvidenceContractV1(pick({
    decision: "WATCH",
    productDecision: "CAUTION"
  })));
  assert.ok(sanitizeDecisionEvidenceSealV1(cautionSeal, { decision: "WATCH", selection: "Home" }));
});

test("Agent explanation sanitizer preserves only a valid structured seal", () => {
  const seal = buildDecisionEvidenceSealV1(buildDecisionEvidenceContractV1(pick()));
  const contract = sanitizeAgentExplanationInput({
    ...pick(),
    decisionEvidenceSeal: seal,
    evidence: ["Verified market evidence."],
    counterArguments: ["The market can still move."],
    missingEvidence: ["latest market refresh"]
  });

  assert.ok(contract);
  assert.equal(contract.contractVersion, "agent-v10-grounded-3");
  assert.equal(contract.eventId, "event-1");
  assert.equal(contract.decisionEvidenceSeal.contractFingerprint, seal.contractFingerprint);
  assert.equal(contract.decisionEvidenceSeal.sealFingerprint, seal.sealFingerprint);
  assert.equal(contract.evidence[0], decisionEvidenceBoundaryText(seal));
  assert.ok(contract.evidence[0].length <= 220);

  const otherSelectionSeal = buildDecisionEvidenceSealV1(buildDecisionEvidenceContractV1(pick({
    selection: "Away"
  })));
  assert.equal(sanitizeAgentExplanationInput({
    ...pick(),
    decisionEvidenceSeal: otherSelectionSeal
  }), null);
});

test("human-readable boundary is derived from the verified seal", () => {
  const seal = buildDecisionEvidenceSealV1(buildDecisionEvidenceContractV1(pick()));
  const boundary = decisionEvidenceBoundaryText(seal);

  assert.match(boundary, new RegExp(seal.contractFingerprint));
  assert.match(boundary, new RegExp(seal.sealFingerprint));
  assert.match(boundary, /Research non-voting/);
  assert.match(boundary, /Context cannot upgrade/);
});
