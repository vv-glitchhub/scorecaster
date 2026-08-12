import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMlbPitchingOffenseShadowV1,
  MLB_PITCHING_OFFENSE_MODEL_ID,
  MLB_PITCHING_OFFENSE_MODEL_VERSION
} from "../lib/mlb-pitching-offense-shadow-v1.mjs";

const NOW = Date.parse("2026-08-12T10:00:00.000Z");
const FIRST_PITCH = "2026-08-12T18:00:00.000Z";

function pick(overrides = {}) {
  return {
    gameId: "mlb-1",
    sportKey: "baseball_mlb",
    league: "MLB",
    homeTeam: "Boston Red Sox",
    awayTeam: "New York Yankees",
    selection: "Boston Red Sox",
    commenceTime: FIRST_PITCH,
    ...overrides
  };
}

function teamObs(side, metric, value, overrides = {}) {
  return {
    participantId: side === "home" ? "Boston Red Sox" : "New York Yankees",
    metric,
    value,
    unit: "z-score",
    observedAt: "2026-08-12T09:00:00.000Z",
    capturedAt: "2026-08-12T09:05:00.000Z",
    provider: "licensed-baseball-analytics",
    sourceTrust: 0.9,
    confidence: 0.9,
    metadata: { side, scale: "z-score" },
    ...overrides
  };
}

function starterObs(side, value, overrides = {}) {
  return {
    participantId: side === "home" ? "Home Starter" : "Away Starter",
    metric: "starting-pitcher-xwoba-allowed",
    value,
    unit: "rate",
    observedAt: "2026-08-12T09:00:00.000Z",
    capturedAt: "2026-08-12T09:05:00.000Z",
    provider: "licensed-baseball-analytics",
    sourceTrust: 0.9,
    confidence: 0.9,
    metadata: { side, starter: true, role: "starting-pitcher" },
    ...overrides
  };
}

function requiredObservations() {
  return [
    teamObs("home", "lineup-strength", 0.7),
    teamObs("home", "bullpen-depth", 0.4),
    starterObs("home", 0.305),
    teamObs("away", "lineup-strength", 0.1),
    teamObs("away", "bullpen-depth", -0.1),
    starterObs("away", 0.345)
  ];
}

test("MLB pitching/offense shadow is deterministic and paper-only", () => {
  const first = buildMlbPitchingOffenseShadowV1(pick(), requiredObservations(), { now: NOW });
  const second = buildMlbPitchingOffenseShadowV1(pick(), requiredObservations(), { now: NOW });
  assert.equal(first.modelId, MLB_PITCHING_OFFENSE_MODEL_ID);
  assert.equal(first.modelVersion, MLB_PITCHING_OFFENSE_MODEL_VERSION);
  assert.equal(first.status, "ready");
  assert.equal(first.probability, second.probability);
  assert.equal(first.inputSnapshotHash, second.inputSnapshotHash);
  assert.ok(first.probability > 0.5 && first.probability < 1);
  assert.equal(first.productionProbabilityChanged, false);
  assert.equal(first.productionDecisionChanged, false);
  assert.equal(first.automaticPromotionAllowed, false);
  assert.equal(first.paperOnly, true);
});

test("home and away probabilities are complements", () => {
  const home = buildMlbPitchingOffenseShadowV1(pick(), requiredObservations(), { now: NOW });
  const away = buildMlbPitchingOffenseShadowV1(pick({ selection: "New York Yankees" }), requiredObservations(), { now: NOW });
  assert.ok(Math.abs(home.probabilities.home + home.probabilities.away - 1) < 1e-6);
  assert.ok(Math.abs(home.probability + away.probability - 1) < 1e-6);
});

test("missing required standardized team input remains unavailable", () => {
  const rows = requiredObservations().filter((row) => !(row.metric === "bullpen-depth" && row.metadata.side === "away"));
  const result = buildMlbPitchingOffenseShadowV1(pick(), rows, { now: NOW });
  assert.equal(result.status, "unavailable");
  assert.equal(result.probability, null);
  assert.ok(result.reasons.includes("missing-away-bullpen-depth-z"));
});

test("raw unstandardized lineup strength is rejected instead of silently mixed", () => {
  const rows = requiredObservations().map((row) => row.metric === "lineup-strength" && row.metadata.side === "home"
    ? { ...row, unit: "rating", metadata: { side: "home" } }
    : row);
  const result = buildMlbPitchingOffenseShadowV1(pick(), rows, { now: NOW });
  assert.equal(result.status, "unavailable");
  assert.ok(result.reasons.includes("missing-home-lineup-strength-z"));
});

test("generic xwOBA cannot masquerade as starting pitcher allowed data", () => {
  const rows = requiredObservations().filter((row) => row.metadata.side !== "away" || row.metric !== "starting-pitcher-xwoba-allowed");
  rows.push({
    ...starterObs("away", 0.35),
    metric: "xwoba",
    metadata: { side: "away" }
  });
  const result = buildMlbPitchingOffenseShadowV1(pick(), rows, { now: NOW });
  assert.equal(result.status, "unavailable");
  assert.ok(result.reasons.includes("missing-away-confirmed-starter-xwoba-allowed"));
});

test("generic xwOBA is accepted only with starting-pitcher and allowed perspective metadata", () => {
  const rows = requiredObservations().filter((row) => row.metadata.side !== "away" || row.metric !== "starting-pitcher-xwoba-allowed");
  rows.push({
    ...starterObs("away", 0.35),
    metric: "xwoba",
    metadata: { side: "away", role: "starting-pitcher", perspective: "allowed" }
  });
  const result = buildMlbPitchingOffenseShadowV1(pick(), rows, { now: NOW });
  assert.equal(result.status, "ready");
});

test("future advanced data is rejected", () => {
  const rows = requiredObservations().map((row) => row.metric === "lineup-strength" && row.metadata.side === "home"
    ? { ...row, observedAt: "2026-08-12T19:00:00.000Z", capturedAt: "2026-08-12T19:00:00.000Z" }
    : row);
  const result = buildMlbPitchingOffenseShadowV1(pick(), rows, { now: NOW });
  assert.equal(result.status, "unavailable");
  assert.ok(result.reasons.includes("missing-home-lineup-strength-z"));
});

test("market providers are blocked from independent MLB inputs", () => {
  const rows = requiredObservations().map((row) => row.metric === "bullpen-depth" && row.metadata.side === "home"
    ? { ...row, provider: "the-odds-api" }
    : row);
  const result = buildMlbPitchingOffenseShadowV1(pick(), rows, { now: NOW });
  assert.equal(result.status, "unavailable");
  assert.ok(result.reasons.includes("missing-home-bullpen-depth-z"));
});

test("starter xwOBA outside plausible allowed-rate range is rejected", () => {
  const rows = requiredObservations().map((row) => row.metric === "starting-pitcher-xwoba-allowed" && row.metadata.side === "away"
    ? { ...row, value: 0.9 }
    : row);
  const result = buildMlbPitchingOffenseShadowV1(pick(), rows, { now: NOW });
  assert.equal(result.status, "unavailable");
  assert.ok(result.reasons.includes("missing-away-confirmed-starter-xwoba-allowed"));
});

test("worse opposing starter increases home shadow probability", () => {
  const baseline = buildMlbPitchingOffenseShadowV1(pick(), requiredObservations(), { now: NOW });
  const worseAwayStarter = requiredObservations().map((row) => row.metric === "starting-pitcher-xwoba-allowed" && row.metadata.side === "away"
    ? { ...row, value: 0.39 }
    : row);
  const shifted = buildMlbPitchingOffenseShadowV1(pick(), worseAwayStarter, { now: NOW });
  assert.ok(shifted.probability > baseline.probability);
});

test("park context is audited but does not change V1 H2H probability", () => {
  const baseline = buildMlbPitchingOffenseShadowV1(pick(), requiredObservations(), { now: NOW });
  const withPark = buildMlbPitchingOffenseShadowV1(pick(), [...requiredObservations(), teamObs("home", "park-adjusted-strength", 1.2)], { now: NOW });
  assert.equal(withPark.probability, baseline.probability);
  assert.equal(withPark.matchup.parkContextZ, 1.2);
  assert.equal(withPark.independentModelOutput.audit.parkContextUsedInProbability, false);
});

test("independent output declares audited lineage and no performance weight", () => {
  const result = buildMlbPitchingOffenseShadowV1(pick(), requiredObservations(), { now: NOW });
  assert.deepEqual(result.independentModelOutput.signalFamilies, ["expected-performance", "performance-statistics"]);
  assert.equal(result.independentModelOutput.audit.independentPredictiveModel, true);
  assert.equal(result.independentModelOutput.audit.chronologySafe, true);
  assert.equal(result.independentModelOutput.audit.noMarketInputs, true);
  assert.equal(result.independentModelOutput.audit.confirmedStartingPitchersRequired, true);
  assert.equal(result.uncertainty.performanceWeightAvailable, false);
});
