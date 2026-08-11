import test from "node:test";
import assert from "node:assert/strict";
import { buildNhlXgGoalieShadowV1, attachNhlXgGoalieShadowV1, NHL_XG_GOALIE_MODEL_ID } from "../lib/nhl-xg-goalie-shadow-v1.mjs";
import { attachDecisionArchitectureV1 } from "../lib/decision-architecture-v1.mjs";

const NOW = Date.parse("2026-10-15T15:00:00.000Z");
const OBSERVED = "2026-10-15T14:30:00.000Z";
const CAPTURED = "2026-10-15T14:35:00.000Z";

function pick(overrides = {}) {
  return {
    gameId: "nhl-event-1",
    sportKey: "icehockey_nhl",
    league: "icehockey_nhl",
    leagueTitle: "NHL",
    market: "h2h",
    commenceTime: "2026-10-15T23:00:00.000Z",
    homeTeam: "Toronto Maple Leafs",
    awayTeam: "Boston Bruins",
    selection: "Toronto Maple Leafs",
    marketProbability: 0.52,
    consensusProbability: 0.52,
    probability: 0.52,
    productDecision: "CAUTION",
    ...overrides
  };
}

function row({ side, metric, value, provider = "licensed-hockey-feed", participantId, starter = false, observedAt = OBSERVED, capturedAt = CAPTURED }) {
  const team = side === "home" ? "Toronto Maple Leafs" : "Boston Bruins";
  return {
    eventId: "nhl-event-1",
    participantId: participantId || team,
    family: metric.includes("gsax") || metric.includes("saved-above") ? "player" : "expected",
    metric,
    value,
    unit: "per-60",
    observedAt,
    capturedAt,
    provider,
    sourceTrust: 0.91,
    confidence: 0.88,
    metadata: starter ? { side, team, starter: true, role: "starting-goalie" } : { side, team }
  };
}

function readyRows() {
  return [
    row({ side: "home", metric: "xg-for-per-60", value: 3.25 }),
    row({ side: "home", metric: "xg-against-per-60", value: 2.75 }),
    row({ side: "home", metric: "post-shot-xg-for-per-60", value: 3.35 }),
    row({ side: "away", metric: "xg-for-per-60", value: 2.85 }),
    row({ side: "away", metric: "xg-against-per-60", value: 3.05 }),
    row({ side: "away", metric: "post-shot-xg-for-per-60", value: 2.8 }),
    row({ side: "home", metric: "goalie-gsax-per-60", value: 0.22, participantId: "Joseph Woll", starter: true }),
    row({ side: "away", metric: "goalie-gsax-per-60", value: -0.08, participantId: "Jeremy Swayman", starter: true })
  ];
}

test("NHL xG goalie V1 produces a deterministic chronology-safe shadow probability", () => {
  const first = buildNhlXgGoalieShadowV1(pick(), readyRows(), { now: NOW });
  const second = buildNhlXgGoalieShadowV1(pick(), readyRows(), { now: NOW });
  assert.equal(first.status, "ready");
  assert.equal(first.modelId, NHL_XG_GOALIE_MODEL_ID);
  assert.equal(first.shadowProbability, second.shadowProbability);
  assert.equal(first.inputSnapshotHash, second.inputSnapshotHash);
  assert.ok(first.shadowProbability > 0 && first.shadowProbability < 1);
  assert.ok(first.projectedGoals.home > 0);
  assert.ok(first.projectedGoals.away > 0);
  assert.equal(first.productionProbabilityChanged, false);
  assert.equal(first.productionDecisionChanged, false);
});

test("home and away selections are complements of the same H2H model", () => {
  const home = buildNhlXgGoalieShadowV1(pick(), readyRows(), { now: NOW });
  const away = buildNhlXgGoalieShadowV1(pick({ selection: "Boston Bruins" }), readyRows(), { now: NOW });
  assert.equal(home.status, "ready");
  assert.equal(away.status, "ready");
  assert.ok(Math.abs((home.shadowProbability + away.shadowProbability) - 1) < 1e-6);
});

test("future required observations cannot leak into the model", () => {
  const rows = readyRows().map((item) => item.metric === "xg-for-per-60" && item.metadata.side === "home"
    ? { ...item, observedAt: "2026-10-15T23:30:00.000Z", capturedAt: "2026-10-15T23:31:00.000Z" }
    : item);
  const result = buildNhlXgGoalieShadowV1(pick(), rows, { now: NOW });
  assert.equal(result.status, "unavailable");
  assert.ok(result.reasons.includes("missing-home-xgf60"));
});

test("confirmed starting goalies are mandatory", () => {
  const rows = readyRows().filter((item) => !(item.metric === "goalie-gsax-per-60" && item.metadata.side === "away"));
  const result = buildNhlXgGoalieShadowV1(pick(), rows, { now: NOW });
  assert.equal(result.status, "unavailable");
  assert.ok(result.reasons.includes("missing-away-gsax60"));
});

test("market and Scorecaster mirror providers cannot become NHL xG model inputs", () => {
  const rows = readyRows().map((item) => ({ ...item, provider: "the-odds-api" }));
  const result = buildNhlXgGoalieShadowV1(pick(), rows, { now: NOW });
  assert.equal(result.status, "unavailable");
  assert.equal(result.inputSummary.eligibleAdvancedObservations, 0);
});

test("optional post-shot xG may be missing without silently imputing it", () => {
  const rows = readyRows().filter((item) => item.metric !== "post-shot-xg-for-per-60");
  const result = buildNhlXgGoalieShadowV1(pick(), rows, { now: NOW });
  assert.equal(result.status, "ready");
  assert.equal(result.uncertainty.optionalPostShotXgMissing, true);
  assert.equal(result.inputSummary, undefined);
  assert.equal(result.formula.postShotWeight, 0.2);
});

test("Model Factory derives the NHL advanced output into expected-performance dependence family", () => {
  const withModel = attachNhlXgGoalieShadowV1(pick(), readyRows(), { now: NOW });
  const result = attachDecisionArchitectureV1(withModel, { now: NOW });
  const model = result.modelFactoryV1.outputs.find((item) => item.modelId === NHL_XG_GOALIE_MODEL_ID);
  assert.ok(model);
  assert.match(model.dependenceGroup, /expected-performance-family/);
  assert.deepEqual(model.signalLineageV1.signalFamilies, ["expected-performance"]);
  assert.equal(result.productionProbabilityAdjustedByFeatureEnsemble, false);
  assert.equal(result.productionDecisionAdjustedByFeatureEnsemble, false);
  assert.equal(result.productDecision, "CAUTION");
});
