import test from "node:test";
import assert from "node:assert/strict";

import { buildIntelligenceFusionV2 } from "../lib/intelligence-fusion-v2.mjs";
import { sanitizeAgentExplanationInput } from "../lib/agent-v10-explanation.mjs";

const NOW = Date.parse("2026-08-11T04:00:00.000Z");

function source(provider, observedAt = "2026-08-11T03:45:00.000Z", trust = 0.84) {
  return [{ provider, type: "verified-provider", trust, observedAt, mode: "live" }];
}

function factor({
  key,
  title,
  status = "ready",
  confidence = 0.8,
  trust = 0.8,
  impact = 0,
  direction = "neutral",
  usedByAi = true,
  downgradeEligible = false,
  observedAt = "2026-08-11T03:45:00.000Z"
}) {
  return {
    key,
    title,
    status,
    confidence,
    trust,
    impact,
    direction,
    useMode: "explanation-and-risk",
    usedByAi,
    downgradeEligible,
    reason: `${title} audited reason`,
    sources: source(key, observedAt, trust)
  };
}

function pickWithFactors(factors, overrides = {}) {
  return {
    gameId: "event-1",
    match: "Home vs Away",
    homeTeam: "Home",
    awayTeam: "Away",
    selection: "Home",
    league: "test-league",
    commenceTime: "2026-08-12T18:00:00.000Z",
    unifiedSportsData: {
      factors,
      coverage: {
        configuredFamilies: factors.length,
        coverageRate: factors.length ? factors.filter((row) => row.usedByAi).length / factors.length : 0,
        sourceCount: factors.length,
        independentOddsProviders: 2
      },
      missingData: []
    },
    sportsIntelligence: { conflicts: [] },
    ...overrides
  };
}

test("Fusion uses only audited eligible evidence and never adjusts probability", () => {
  const pick = pickWithFactors([
    factor({ key: "odds-consensus", title: "Odds consensus", confidence: 0.92, trust: 0.86 }),
    factor({ key: "injuries", title: "Injuries", status: "checked-no-impact", confidence: 0.82, trust: 0.8 }),
    factor({ key: "weather", title: "Weather", status: "missing", confidence: 0, trust: 0, usedByAi: false })
  ]);
  pick.unifiedSportsData.coverage.coverageRate = 0.67;
  pick.unifiedSportsData.missingData = [{ factor: "weather", reason: "outdoor weather check unavailable" }];

  const result = buildIntelligenceFusionV2(pick, { now: NOW });

  assert.equal(result.version, "intelligence-fusion-v2");
  assert.equal(result.eligibleFactors.length, 2);
  assert.equal(result.ignoredFactors.length, 1);
  assert.equal(result.ignoredFactors[0].key, "weather");
  assert.equal(result.dataQualityGate.decisionCeiling, "PLAY");
  assert.equal(result.probabilityAdjusted, false);
  assert.equal(result.marketProbabilityRemainsCanonical, true);
  assert.equal(result.rules.contextCanUpgrade, false);
  assert.ok(result.explanationEvidence.some((line) => line.includes("Injuries")));
  assert.ok(result.missingEvidence.some((line) => line.includes("outdoor weather")));
});

test("Low-trust positive context is ignored instead of helping the AI", () => {
  const result = buildIntelligenceFusionV2(pickWithFactors([
    factor({ key: "odds-consensus", title: "Odds consensus", confidence: 0.9, trust: 0.86 }),
    factor({ key: "rumor", title: "Rumor", confidence: 0.9, trust: 0.2, impact: 0.05, direction: "positive" })
  ]), { now: NOW });

  const rumor = result.ignoredFactors.find((row) => row.key === "rumor");
  assert.ok(rumor);
  assert.ok(rumor.ignoredReasons.some((reason) => reason.includes("trust below")));
  assert.ok(!result.explanationEvidence.some((line) => line.includes("Rumor")));
  assert.equal(result.rules.contextCanUpgrade, false);
  assert.equal(result.probabilityAdjusted, false);
});

test("Verified adverse evidence imposes a CAUTION ceiling", () => {
  const result = buildIntelligenceFusionV2(pickWithFactors([
    factor({ key: "odds-consensus", title: "Odds consensus", confidence: 0.9, trust: 0.86 }),
    factor({
      key: "injuries",
      title: "Injuries",
      confidence: 0.9,
      trust: 0.9,
      impact: -0.03,
      direction: "negative",
      downgradeEligible: true
    })
  ]), { now: NOW });

  assert.equal(result.adverseFactors.length, 1);
  assert.equal(result.dataQualityGate.decisionCeiling, "CAUTION");
  assert.ok(result.dataQualityGate.reasons.some((reason) => reason.includes("adverse")));
});

test("Future-dated evidence fails chronology guard and cannot enter AI context", () => {
  const result = buildIntelligenceFusionV2(pickWithFactors([
    factor({ key: "odds-consensus", title: "Odds consensus", confidence: 0.9, trust: 0.86 }),
    factor({
      key: "lineups",
      title: "Lineups",
      confidence: 0.95,
      trust: 0.9,
      impact: 0.03,
      direction: "positive",
      observedAt: "2026-08-11T05:00:00.000Z"
    })
  ]), { now: NOW });

  const lineups = result.ignoredFactors.find((row) => row.key === "lineups");
  assert.ok(lineups);
  assert.ok(lineups.ignoredReasons.includes("future-dated source evidence"));
  assert.equal(result.dataQualityGate.decisionCeiling, "CAUTION");
  assert.equal(result.dataQualityGate.safeForAi, false);
  assert.ok(!result.explanationEvidence.some((line) => line.includes("Lineups")));
});

test("Missing audited odds consensus fails closed", () => {
  const result = buildIntelligenceFusionV2(pickWithFactors([
    factor({ key: "injuries", title: "Injuries", confidence: 0.8, trust: 0.8 })
  ]), { now: NOW });

  assert.equal(result.dataQualityGate.decisionCeiling, "SKIP");
  assert.ok(result.dataQualityGate.reasons.some((reason) => reason.includes("odds consensus")));
});

test("Grounded Agent explanation prioritizes fused audited evidence", () => {
  const contract = sanitizeAgentExplanationInput({
    decision: "PLAY",
    match: "Home vs Away",
    selection: "Home",
    league: "Test",
    bookmaker: "Book",
    odds: 2,
    consensusProbability: 0.55,
    evidence: ["Legacy market evidence"],
    counterArguments: ["Legacy counterpoint"],
    missingEvidence: ["Legacy missing evidence"],
    intelligenceFusionV2: {
      explanationEvidence: ["Verified lineup evidence from the audited fusion layer"],
      counterArguments: ["Weather evidence remains unavailable"],
      missingEvidence: ["confirmed weather observation"]
    }
  });

  assert.ok(contract);
  assert.equal(contract.evidence[0], "Verified lineup evidence from the audited fusion layer");
  assert.equal(contract.counterArguments[0], "Weather evidence remains unavailable");
  assert.equal(contract.missingEvidence[0], "confirmed weather observation");
  assert.ok(contract.evidence.includes("Legacy market evidence"));
});
