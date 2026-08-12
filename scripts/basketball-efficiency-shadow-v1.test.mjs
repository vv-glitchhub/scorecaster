import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBasketballEfficiencyShadowV1,
  BASKETBALL_EFFICIENCY_SHADOW_VERSION
} from "../lib/basketball-efficiency-shadow-v1.mjs";

const NOW = Date.parse("2026-08-12T10:00:00.000Z");
const TIP = "2026-08-12T18:00:00.000Z";

function pick(overrides = {}) {
  return {
    gameId: "nba-1",
    sportKey: "basketball_nba",
    league: "NBA",
    homeTeam: "Boston Celtics",
    awayTeam: "New York Knicks",
    selection: "Boston Celtics",
    commenceTime: TIP,
    ...overrides
  };
}

function obs(side, metric, value, overrides = {}) {
  return {
    participantId: side === "home" ? "Boston Celtics" : "New York Knicks",
    metric,
    value,
    observedAt: "2026-08-12T09:00:00.000Z",
    capturedAt: "2026-08-12T09:05:00.000Z",
    provider: "licensed-basketball-analytics",
    sourceTrust: 0.9,
    confidence: 0.9,
    metadata: { side },
    ...overrides
  };
}

function requiredObservations() {
  return [
    obs("home", "pace", 100),
    obs("home", "offensive-rating", 118),
    obs("home", "defensive-rating", 108),
    obs("away", "pace", 98),
    obs("away", "offensive-rating", 111),
    obs("away", "defensive-rating", 114)
  ];
}

test("NBA efficiency shadow is deterministic and paper-only", () => {
  const first = buildBasketballEfficiencyShadowV1(pick(), requiredObservations(), { now: NOW });
  const second = buildBasketballEfficiencyShadowV1(pick(), requiredObservations(), { now: NOW });
  assert.equal(first.version, BASKETBALL_EFFICIENCY_SHADOW_VERSION);
  assert.equal(first.modelId, "nba-efficiency-pace-v1");
  assert.equal(first.modelVersion, "nba-efficiency-pace-shadow-v1");
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
  const home = buildBasketballEfficiencyShadowV1(pick(), requiredObservations(), { now: NOW });
  const away = buildBasketballEfficiencyShadowV1(pick({ selection: "New York Knicks" }), requiredObservations(), { now: NOW });
  assert.ok(Math.abs(home.probabilities.home + home.probabilities.away - 1) < 1e-6);
  assert.ok(Math.abs(home.probability + away.probability - 1) < 1e-6);
});

test("WNBA uses a distinct model identity for holdout separation", () => {
  const observations = requiredObservations().map((row) => ({
    ...row,
    participantId: row.metadata.side === "home" ? "Minnesota Lynx" : "Las Vegas Aces"
  }));
  const result = buildBasketballEfficiencyShadowV1(pick({
    gameId: "wnba-1",
    sportKey: "basketball_wnba",
    league: "WNBA",
    homeTeam: "Minnesota Lynx",
    awayTeam: "Las Vegas Aces",
    selection: "Minnesota Lynx"
  }), observations, { now: NOW });
  assert.equal(result.status, "ready");
  assert.equal(result.modelId, "wnba-efficiency-pace-v1");
  assert.equal(result.modelVersion, "wnba-efficiency-pace-shadow-v1");
});

test("missing required efficiency inputs remain missing", () => {
  const result = buildBasketballEfficiencyShadowV1(pick(), requiredObservations().filter((row) => row.metric !== "defensive-rating" || row.metadata.side !== "away"), { now: NOW });
  assert.equal(result.status, "unavailable");
  assert.equal(result.probability, null);
  assert.ok(result.reasons.includes("missing-away-defensive-rating"));
});

test("future observations cannot enter the prediction", () => {
  const rows = requiredObservations().map((row) => row.metric === "offensive-rating" && row.metadata.side === "home"
    ? { ...row, observedAt: "2026-08-12T19:00:00.000Z", capturedAt: "2026-08-12T19:00:00.000Z" }
    : row);
  const result = buildBasketballEfficiencyShadowV1(pick(), rows, { now: NOW });
  assert.equal(result.status, "unavailable");
  assert.ok(result.reasons.includes("missing-home-offensive-rating"));
});

test("market and mirrored providers cannot masquerade as efficiency inputs", () => {
  const rows = requiredObservations().map((row) => row.metric === "pace" && row.metadata.side === "home"
    ? { ...row, provider: "the-odds-api" }
    : row);
  const result = buildBasketballEfficiencyShadowV1(pick(), rows, { now: NOW });
  assert.equal(result.status, "unavailable");
  assert.ok(result.reasons.includes("missing-home-pace"));
});

test("lineup impact is optional and bounded", () => {
  const baseline = buildBasketballEfficiencyShadowV1(pick(), requiredObservations(), { now: NOW });
  const plusFive = buildBasketballEfficiencyShadowV1(pick(), [...requiredObservations(), obs("home", "lineup-adjusted-impact", 5)], { now: NOW });
  const extreme = buildBasketballEfficiencyShadowV1(pick(), [...requiredObservations(), obs("home", "lineup-adjusted-impact", 100)], { now: NOW });
  assert.equal(plusFive.probability, extreme.probability);
  assert.ok(plusFive.probability > baseline.probability);
});

test("independent output publishes audited non-market lineage", () => {
  const result = buildBasketballEfficiencyShadowV1(pick(), requiredObservations(), { now: NOW });
  assert.deepEqual(result.independentModelOutput.signalFamilies, ["performance-statistics", "context"]);
  assert.equal(result.independentModelOutput.audit.independentPredictiveModel, true);
  assert.equal(result.independentModelOutput.audit.deterministic, true);
  assert.equal(result.independentModelOutput.audit.chronologySafe, true);
  assert.equal(result.independentModelOutput.audit.noMarketInputs, true);
  assert.equal(result.uncertainty.performanceWeightAvailable, false);
});
