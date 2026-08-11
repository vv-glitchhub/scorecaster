import test from "node:test";
import assert from "node:assert/strict";
import { buildSoccerXgPoissonShadowV1 } from "../lib/soccer-xg-poisson-shadow-v1.mjs";

const NOW = Date.parse("2026-08-11T12:00:00.000Z");
const COMMENCE = "2026-08-11T18:00:00.000Z";

function pick(selection = "Arsenal") {
  return {
    id: "soccer-event-1",
    sportKey: "soccer_epl",
    league: "EPL",
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    selection,
    commenceTime: COMMENCE
  };
}

function row(metric, value, side, options = {}) {
  return {
    eventId: "soccer-event-1",
    participantId: side === "home" ? "Arsenal" : "Chelsea",
    family: "expected",
    metric,
    value,
    unit: "per-90",
    observedAt: options.observedAt || "2026-08-11T10:00:00.000Z",
    capturedAt: options.capturedAt || "2026-08-11T10:05:00.000Z",
    provider: options.provider || "licensed-xg-provider",
    sourceTrust: 0.9,
    confidence: 0.85,
    metadata: { side }
  };
}

function inputs() {
  return [
    row("xg-for-per-90", 1.9, "home"),
    row("xg-against-per-90", 1.0, "home"),
    row("post-shot-xg-for-per-90", 2.0, "home"),
    row("xg-for-per-90", 1.35, "away"),
    row("xg-against-per-90", 1.45, "away"),
    row("post-shot-xg-for-per-90", 1.25, "away")
  ];
}

test("soccer xG Poisson is deterministic and exposes a normalized 1X2 distribution", () => {
  const first = buildSoccerXgPoissonShadowV1(pick("Arsenal"), inputs(), { now: NOW });
  const second = buildSoccerXgPoissonShadowV1(pick("Arsenal"), inputs(), { now: NOW });
  assert.equal(first.status, "ready");
  assert.equal(first.inputSnapshotHash, second.inputSnapshotHash);
  assert.equal(first.probability, second.probability);
  const total = first.probabilities.home + first.probabilities.draw + first.probabilities.away;
  assert.ok(Math.abs(total - 1) < 0.00001);
  assert.equal(first.independentModelOutput.signalFamilies[0], "expected-performance");
  assert.equal(first.productionProbabilityChanged, false);
});

test("home draw and away selections map to the same event distribution", () => {
  const home = buildSoccerXgPoissonShadowV1(pick("Arsenal"), inputs(), { now: NOW });
  const draw = buildSoccerXgPoissonShadowV1(pick("Draw"), inputs(), { now: NOW });
  const away = buildSoccerXgPoissonShadowV1(pick("Chelsea"), inputs(), { now: NOW });
  assert.equal(home.probability, home.probabilities.home);
  assert.equal(draw.probability, home.probabilities.draw);
  assert.equal(away.probability, home.probabilities.away);
});

test("future-only or market-derived soccer xG observations fail closed", () => {
  const future = inputs().map((item) => ({ ...item, observedAt: "2026-08-11T19:00:00.000Z", capturedAt: "2026-08-11T19:00:00.000Z" }));
  const market = inputs().map((item) => ({ ...item, provider: "the-odds-api" }));
  const futureResult = buildSoccerXgPoissonShadowV1(pick(), future, { now: NOW });
  const marketResult = buildSoccerXgPoissonShadowV1(pick(), market, { now: NOW });
  assert.equal(futureResult.status, "unavailable");
  assert.equal(marketResult.status, "unavailable");
  assert.equal(futureResult.probability, null);
  assert.equal(marketResult.probability, null);
});
