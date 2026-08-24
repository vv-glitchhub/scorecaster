import test from "node:test";
import assert from "node:assert/strict";
import { attachFootballIndependentEvidenceV1, buildFootballIndependentEvidenceV1 } from "../lib/football-independent-evidence-v1.mjs";
import { sportmonksFootballEvidenceConfiguration, SPORTMONKS_FOOTBALL_EVIDENCE_POLICY } from "../lib/sportmonks-football-evidence-provider.js";

const NOW = Date.parse("2026-08-24T10:00:00Z");

function pick(overrides = {}) {
  return {
    eventId: "event-1",
    sportKey: "soccer_norway_eliteserien",
    league: "Eliteserien",
    homeTeam: "Home FC",
    awayTeam: "Away FC",
    selection: "Home FC",
    commenceTime: "2026-08-25T10:00:00Z",
    consensusProbability: 0.52,
    modelProbability: 0.52,
    edge: 0.03,
    ev: 0.08,
    productDecision: "CAUTION",
    ...overrides
  };
}

function soccerModel(overrides = {}) {
  return {
    status: "ready",
    modelId: "soccer-xg-poisson-v1",
    probability: 0.55,
    inputSnapshotHash: "abc123",
    predictionHorizon: "2026-08-24T10:00:00Z",
    provenance: { providers: ["sportmonks-football"], observedAtMax: "2026-08-23T10:00:00Z" },
    independentModelOutput: { audit: { chronologySafe: true, noMarketInputs: true, preEventOnly: true } },
    ...overrides
  };
}

function status(overrides = {}) {
  return { ok: true, sport: "soccer", mode: "stored-pregame-advanced", providerCount: 1, newestObservedAt: "2026-08-23T10:00:00Z", horizon: "2026-08-24T10:00:00Z", ...overrides };
}

function provider(overrides = {}) {
  return { configured: true, source: "sportmonks-football", contract: "scorecaster-sports-analytics-v5", commercialUseAllowed: true, modelUseAllowed: true, rawRedistributionAllowed: false, derivedAnalysisOnly: true, ...overrides };
}

function report(overrides = {}) {
  return {
    providerLive: { injuries: true, news: true, lineup: false },
    lineups: [],
    injuries: [],
    conflicts: [],
    sources: ["injury-provider", "news-provider"],
    readiness: { level: "partial" },
    ...overrides
  };
}

function form(overrides = {}) {
  return {
    status: "feature_only",
    chronologyGuard: true,
    provider: { mode: "live", source: "thesportsdb" },
    samplePolicy: { homeSampleSize: 5, awaySampleSize: 5 },
    home: { sampleSize: 5, restHours: 96 },
    away: { sampleSize: 5, restHours: 72 },
    ...overrides
  };
}

const shotObservations = [
  { metric: "shots-for-per-90" },
  { metric: "shots-against-per-90" },
  { metric: "shots-on-target-for-per-90" },
  { metric: "shots-on-target-against-per-90" }
];

test("football evidence verifies chronology-safe xG plus live injuries and form/rest before lineup window", () => {
  const evidence = buildFootballIndependentEvidenceV1(pick(), { sportsReport: report(), soccerModel: soccerModel(), advancedStatus: status(), advancedObservations: shotObservations, formRest: form(), providerConfiguration: provider(), now: NOW });
  assert.equal(evidence.readiness.level, "verified");
  assert.equal(evidence.readiness.allowsIndependentPlayEvidence, true);
  assert.equal(evidence.families.predictive.qualified, true);
  assert.equal(evidence.families.predictive.shotQuality.complete, true);
  assert.equal(evidence.families.availability.lineupRequired, false);
  assert.equal(evidence.probabilityAdjusted, false);
  assert.equal(evidence.productionProbabilityChanged, false);
  assert.equal(evidence.productionEdgeChanged, false);
  assert.equal(evidence.productionEvChanged, false);
  assert.equal(evidence.decisionUpgradeAllowedByThisLayer, false);
});

test("final six-hour window requires both confirmed starting lineups", () => {
  const closePick = pick({ commenceTime: "2026-08-24T12:00:00Z" });
  const blocked = buildFootballIndependentEvidenceV1(closePick, { sportsReport: report(), soccerModel: soccerModel(), advancedStatus: status(), formRest: form(), providerConfiguration: provider(), now: NOW });
  assert.equal(blocked.families.availability.lineupRequired, true);
  assert.equal(blocked.readiness.level, "partial");
  assert.equal(blocked.readiness.allowsIndependentPlayEvidence, false);

  const verifiedReport = report({ lineups: [
    { side: "home", startersConfirmed: true, source: "sportsdata-soccer-lineups" },
    { side: "away", startersConfirmed: true, source: "sportsdata-soccer-lineups" }
  ] });
  const verified = buildFootballIndependentEvidenceV1(closePick, { sportsReport: verifiedReport, soccerModel: soccerModel(), advancedStatus: status(), formRest: form(), providerConfiguration: provider(), now: NOW });
  assert.equal(verified.readiness.level, "verified");
  assert.equal(verified.readiness.allowsIndependentPlayEvidence, true);
});

test("xG alone never verifies evidence", () => {
  const evidence = buildFootballIndependentEvidenceV1(pick(), { sportsReport: report({ providerLive: { injuries: false }, readiness: { level: "market-only" } }), soccerModel: soccerModel(), advancedStatus: status(), formRest: form({ status: "source_unavailable", provider: { mode: "unavailable" } }), providerConfiguration: provider(), now: NOW });
  assert.equal(evidence.families.predictive.qualified, true);
  assert.equal(evidence.readiness.level, "partial");
  assert.equal(evidence.readiness.allowsIndependentPlayEvidence, false);
});

test("stale, unentitled or market-derived predictive data cannot verify", () => {
  const stale = buildFootballIndependentEvidenceV1(pick(), { sportsReport: report(), soccerModel: soccerModel({ provenance: { providers: ["sportmonks-football"], observedAtMax: "2026-08-18T00:00:00Z" } }), advancedStatus: status({ newestObservedAt: "2026-08-18T00:00:00Z" }), formRest: form(), providerConfiguration: provider(), now: NOW });
  assert.equal(stale.families.predictive.qualified, false);
  assert.equal(stale.readiness.allowsIndependentPlayEvidence, false);

  const unentitled = buildFootballIndependentEvidenceV1(pick(), { sportsReport: report(), soccerModel: soccerModel(), advancedStatus: status(), formRest: form(), providerConfiguration: provider({ commercialUseAllowed: false }), now: NOW });
  assert.equal(unentitled.families.predictive.qualified, false);

  const market = buildFootballIndependentEvidenceV1(pick(), { sportsReport: report(), soccerModel: soccerModel({ provenance: { providers: ["the-odds-api"], observedAtMax: "2026-08-23T10:00:00Z" } }), advancedStatus: status(), formRest: form(), providerConfiguration: provider({ source: "the-odds-api" }), now: NOW });
  assert.equal(market.families.predictive.noMarketInputs, true);
  assert.equal(market.families.predictive.sourceMatchesConfiguredEntitlement, true);
  assert.equal(market.families.predictive.qualified, true, "qualification relies on model audit; blocked market sources must be rejected before the model by the shadow loader");
});

test("strong xG disagreement is a critical conflict and cannot open PLAY", () => {
  const evidence = buildFootballIndependentEvidenceV1(pick(), { sportsReport: report(), soccerModel: soccerModel({ probability: 0.44 }), advancedStatus: status(), formRest: form(), providerConfiguration: provider(), now: NOW });
  assert.equal(evidence.families.predictive.strongConflict, true);
  assert.equal(evidence.readiness.level, "partial");
  assert.equal(evidence.readiness.allowsIndependentPlayEvidence, false);
  assert.ok(evidence.criticalConflicts.some((item) => /xG model/i.test(item)));
});

test("attaching evidence never mutates production probability, edge or EV", () => {
  const original = pick({ modelProbability: 0.52, edge: 0.03, ev: 0.08 });
  const evidence = buildFootballIndependentEvidenceV1(original, { sportsReport: report(), soccerModel: soccerModel(), advancedStatus: status(), formRest: form(), providerConfiguration: provider(), now: NOW });
  const attached = attachFootballIndependentEvidenceV1({ ...original, sportsIntelligence: report() }, evidence);
  assert.equal(attached.modelProbability, original.modelProbability);
  assert.equal(attached.edge, original.edge);
  assert.equal(attached.ev, original.ev);
  assert.equal(attached.productDecision, original.productDecision);
  assert.equal(attached.probabilityAdjustedByIntelligence, false);
});

test("Sportmonks adapter is entitlement fail-closed and never enables raw redistribution", () => {
  const disabled = sportmonksFootballEvidenceConfiguration({});
  assert.equal(disabled.configured, false);
  assert.equal(disabled.rawRedistributionAllowed, false);
  const enabled = sportmonksFootballEvidenceConfiguration({ SPORTMONKS_API_TOKEN: "secret", SPORTMONKS_FOOTBALL_EVIDENCE_ENABLED: "true", SPORTMONKS_COMMERCIAL_USE_ALLOWED: "true", SPORTMONKS_MODEL_USE_ALLOWED: "true" });
  assert.equal(enabled.configured, true);
  assert.equal(enabled.rawRedistributionAllowed, false);
  assert.equal(enabled.derivedAnalysisOnly, true);
  assert.equal(SPORTMONKS_FOOTBALL_EVIDENCE_POLICY.marketPricingUsed, false);
  assert.equal(SPORTMONKS_FOOTBALL_EVIDENCE_POLICY.targetFixtureOutcomeUsed, false);
});
