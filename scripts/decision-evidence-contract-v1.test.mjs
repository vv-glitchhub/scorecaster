import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildDecisionEvidenceContractV1, DECISION_EVIDENCE_CONTRACT_VERSION } from "../lib/decision-evidence-contract-v1.mjs";

function verifiedPick(overrides = {}) {
  return {
    gameId: "event-1",
    selection: "Home",
    productDecision: "PLAY",
    decision: "BET",
    marketDecisionBeforeSafetyGate: "BET",
    decisionReason: "PLAY: production gates passed.",
    odds: 2.05,
    bookmaker: "Example Book",
    bookmakerCount: 6,
    consensusProbability: 0.51,
    marketProbability: 0.4878,
    fairOdds: 1.9608,
    edge: 0.0222,
    ev: 0.045,
    confidence: 0.72,
    freshnessLabel: "fresh",
    fixtureVerifiedByProvider: true,
    fixtureSource: "live-odds-provider",
    commenceTime: "2026-08-15T18:00:00Z",
    qualityGrade: "A",
    dataGate: { bookmakerCount: 6, confidence: 0.72, freshness: "fresh", stale: false, playable: true, watchable: true },
    sportsIntelligence: {
      readiness: { level: "verified", verifiedCount: 3, totalChecks: 3, missing: [] },
      sourceCount: 2,
      conflicts: []
    },
    intelligenceRelativeImpact: 0,
    evidenceGateReason: "Independent evidence passed the downgrade-only safety gate.",
    intelligenceFusionV2: { missingEvidence: [] },
    featureEngineV1: {
      snapshotHash: "feature-hash",
      eligibilityRate: 0.75,
      counts: { total: 4, eligible: 3 },
      missingFeatures: [{ id: "starter-confirmation" }]
    },
    ensembleEngineV1: {
      shadowProbability: 0.54,
      calibratedShadowProbability: 0.53,
      counts: { researchEligible: 2, calibrationReady: 1 },
      researchRiskGate: { decision: "NO_BET" },
      models: [{
        modelId: "research-1",
        modelVersion: "research-1-v1",
        probability: 0.55,
        independentPredictiveModel: true,
        eligibleForDecisionWeight: false,
        performance: { sampleSize: 42, calibrationReady: false }
      }]
    },
    uncertaintyEngineV1: { uncertaintyIndex: 31, evidenceReadiness: 69 },
    formRestShadow: { status: "ready", probabilityDelta: 0.012, chronologyGuard: true },
    ...overrides
  };
}

test("Decision Evidence V1 is deterministic and fingerprinted", () => {
  const first = buildDecisionEvidenceContractV1(verifiedPick());
  const second = buildDecisionEvidenceContractV1(verifiedPick());
  assert.equal(first.version, DECISION_EVIDENCE_CONTRACT_VERSION);
  assert.equal(first.fingerprint, second.fingerprint);
  assert.match(first.fingerprint, /^[a-f0-9]{64}$/);
});

test("production decision inputs are separated from research-only evidence", () => {
  const contract = buildDecisionEvidenceContractV1(verifiedPick());
  assert.equal(contract.decision.productDecision, "PLAY");
  assert.equal(contract.decisionInputs.marketQuality.usedForDecision, true);
  assert.equal(contract.decisionInputs.priceValue.usedForDecision, true);
  assert.equal(contract.decisionInputs.independentSafetyGate.usedForDecision, true);
  assert.equal(contract.decisionInputs.independentSafetyGate.mayUpgradeMarketDecision, false);
  assert.equal(contract.decisionInputs.independentSafetyGate.mayDowngradeMarketDecision, true);
  assert.equal(contract.researchOnly.featureEngine.usedForDecision, false);
  assert.equal(contract.researchOnly.ensemble.usedForDecision, false);
  assert.equal(contract.researchOnly.uncertainty.usedForDecision, false);
  assert.equal(contract.researchOnly.formRest.usedForDecision, false);
  assert.equal(contract.researchOnly.ensemble.models[0].usedForDecision, false);
});

test("missing numeric evidence stays missing while an observed zero stays zero", () => {
  const missing = buildDecisionEvidenceContractV1({ gameId: "missing", selection: "Away", productDecision: "CAUTION" });
  assert.equal(missing.known.market.edge, null);
  assert.equal(missing.known.market.ev, null);
  assert.equal(missing.known.market.confidence, null);
  assert.equal(missing.known.independentEvidence.sourceCount, null);
  assert.equal(missing.known.independentEvidence.conflicts, null);
  assert.equal(missing.decisionInputs.independentSafetyGate.conflictCount, null);

  const zero = buildDecisionEvidenceContractV1(verifiedPick({
    gameId: "zero",
    productDecision: "SKIP",
    decision: "PASS",
    odds: 2,
    bookmakerCount: 0,
    edge: 0,
    ev: 0,
    confidence: 0,
    dataGate: { bookmakerCount: 0, confidence: 0, freshness: "fresh", stale: false, playable: false, watchable: false }
  }));
  assert.equal(zero.known.market.edge, 0);
  assert.equal(zero.known.market.ev, 0);
  assert.equal(zero.known.market.confidence, 0);
  assert.equal(zero.decisionInputs.marketQuality.bookmakerCount, 0);
  assert.equal(zero.decision.productDecision, "SKIP");
});

test("missing evidence is explicit and deduplicated", () => {
  const contract = buildDecisionEvidenceContractV1(verifiedPick({
    sportsIntelligence: { readiness: { level: "partial", verifiedCount: 1, totalChecks: 3, missing: ["lineup", "lineup"] }, sourceCount: 1, conflicts: [] },
    intelligenceFusionV2: { missingEvidence: ["weather"] },
    featureEngineV1: { counts: { total: 2, eligible: 0 }, missingFeatures: [{ id: "goalie" }, { id: "goalie" }] }
  }));
  assert.deepEqual(contract.missing, ["lineup", "weather", "goalie"]);
});

test("contract invariants preserve the Scorecaster production boundary", () => {
  const contract = buildDecisionEvidenceContractV1(verifiedPick());
  assert.equal(contract.decision.productionProbabilitySource, "no-vig-market-consensus");
  assert.equal(contract.decision.productionProbabilityChangedByResearch, false);
  assert.equal(contract.decision.productionDecisionChangedByResearch, false);
  assert.deepEqual(contract.invariants, {
    missingDataImputed: false,
    marketBenchmarkIsIndependentPredictiveModel: false,
    researchMayMasqueradeAsDecisionInput: false,
    automaticModelPromotionAllowed: false,
    contextCanUpgrade: false,
    paperOnly: true,
    realMoneyActionAvailable: false
  });
});

test("Event Detail exposes one contract per event selection", () => {
  const route = fs.readFileSync(new URL("../app/api/event-detail/route.js", import.meta.url), "utf8");
  assert.match(route, /buildDecisionEvidenceContractV1/);
  assert.match(route, /eventPicks\.map/);
  assert.match(route, /decisionEvidenceVersion/);
  assert.match(route, /decisionEvidence:/);
});

test("Decision Evidence UI is read-only and Match Intelligence links to it", () => {
  const client = fs.readFileSync(new URL("../app/decision-evidence/DecisionEvidenceClient.jsx", import.meta.url), "utf8");
  const matchPage = fs.readFileSync(new URL("../app/match-intelligence/page.jsx", import.meta.url), "utf8");
  assert.equal(client.split("fetch(").length - 1, 1);
  assert.match(client, /\/api\/event-detail/);
  assert.equal(client.includes('method: "POST"'), false);
  assert.match(client, /data-production-decision-inputs/);
  assert.match(client, /NOT USED/);
  assert.match(matchPage, /data-decision-evidence-link/);
  assert.match(matchPage, /\/decision-evidence\?eventId=/);
});
