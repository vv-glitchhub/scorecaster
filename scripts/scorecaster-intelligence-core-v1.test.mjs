import test from "node:test";
import assert from "node:assert/strict";
import {
  OWN_FOOTBALL_MODEL_ID,
  buildFactConsensus,
  buildFootballTeamStates,
  predictOwnFootballMatch,
  buildLearningExample,
} from "../lib/scorecaster-intelligence-core-v1.mjs";
import { getCollectorSource } from "../lib/collector-source-registry.mjs";

function fact(source_id, value_numeric, extra = {}) {
  return {
    source_id,
    value_numeric,
    source_trust: 0.9,
    confidence: 0.9,
    independence_class: "independent",
    commercial_use_allowed: true,
    model_training_allowed: true,
    ...extra,
  };
}

function finalOutcome({ id, date, home, away, hg, ag }) {
  const kickoff = `${date}T15:00:00.000Z`;
  return {
    id,
    outcome_hash: `hash-${id}`,
    event_id: `event-${id}`,
    sport_key: "soccer_epl",
    league: "Premier League",
    home_team: home,
    away_team: away,
    commence_time: kickoff,
    status: "final",
    home_score: hg,
    away_score: ag,
    outcome: hg > ag ? "home" : hg < ag ? "away" : "draw",
    resolved_at: `${date}T17:00:00.000Z`,
    observed_at: `${date}T17:00:00.000Z`,
    captured_at: `${date}T18:00:00.000Z`,
    finality_verified: true,
    source_ids: ["openfootball_cc0"],
  };
}

test("OpenFootball is a production-approved CC0 training source", () => {
  const source = getCollectorSource("openfootball_cc0");
  assert.ok(source);
  assert.equal(source.enabled, true);
  assert.equal(source.accessMode, "production");
  assert.equal(source.commercialUseAllowed, true);
  assert.equal(source.modelTrainingAllowed, true);
  assert.equal(source.redistributionAllowed, true);
  assert.equal(source.license, "CC0-1.0");
});

test("market facts never count toward independent consensus quorum", () => {
  const result = buildFactConsensus([
    fact("independent-a", 1.25),
    fact("the_odds_api", 1.26, { independence_class: "market" }),
  ]);
  assert.equal(result.sourceCount, 1);
  assert.equal(result.verified, false);
  assert.equal(result.status, "single-source");
});

test("two agreeing independent sources can verify a fact", () => {
  const result = buildFactConsensus([fact("a", 1.25), fact("b", 1.27)]);
  assert.equal(result.sourceCount, 2);
  assert.equal(result.conflict, false);
  assert.equal(result.verified, true);
  assert.equal(result.status, "verified");
});

test("independent source disagreement fails closed", () => {
  const result = buildFactConsensus([fact("a", 1.0), fact("b", 2.0)], { tolerance: 0.08 });
  assert.equal(result.conflict, true);
  assert.equal(result.verified, false);
  assert.equal(result.status, "conflict");
});

test("team-state builder never uses outcomes after asOf", () => {
  const rows = [
    finalOutcome({ id: 1, date: "2026-01-01", home: "Alpha FC", away: "Beta FC", hg: 2, ag: 0 }),
    finalOutcome({ id: 2, date: "2026-02-01", home: "Alpha FC", away: "Beta FC", hg: 0, ag: 5 }),
  ];
  const states = buildFootballTeamStates(rows, "2026-01-15T00:00:00.000Z");
  assert.equal(states.get("alpha-fc")?.matches, 1);
  assert.equal(states.get("beta-fc")?.matches, 1);
  assert.equal(states.get("alpha-fc")?.wins, 1);
});

test("own football baseline is market-independent and returns normalized probabilities", () => {
  const rows = [];
  for (let index = 0; index < 7; index += 1) {
    const day = String(index + 1).padStart(2, "0");
    rows.push(finalOutcome({ id: `a${index}`, date: `2026-01-${day}`, home: "Alpha FC", away: "Gamma FC", hg: 2, ag: 1 }));
    rows.push(finalOutcome({ id: `b${index}`, date: `2026-01-${String(index + 10).padStart(2, "0")}`, home: "Beta FC", away: "Delta FC", hg: 1, ag: index % 2 }));
  }
  const states = buildFootballTeamStates(rows, "2026-02-01T00:00:00.000Z");
  const prediction = predictOwnFootballMatch({
    homeTeam: "Alpha FC",
    awayTeam: "Beta FC",
    commenceTime: "2026-02-05T18:00:00.000Z",
    league: "Premier League",
    teamStates: states,
    asOf: "2026-02-01T00:00:00.000Z",
  });
  assert.equal(prediction.status, "ready");
  assert.equal(prediction.modelId, OWN_FOOTBALL_MODEL_ID);
  assert.equal(prediction.independentFromMarket, true);
  assert.equal(prediction.shadowOnly, true);
  assert.equal(prediction.calibration.productionEligible, false);
  const total = prediction.probabilities.home + prediction.probabilities.draw + prediction.probabilities.away;
  assert.ok(Math.abs(total - 1) < 1e-10);
  assert.equal("market" in prediction, false);
});

test("own model fails closed with insufficient team history", () => {
  const prediction = predictOwnFootballMatch({
    homeTeam: "New Team A",
    awayTeam: "New Team B",
    commenceTime: "2026-02-05T18:00:00.000Z",
    teamStates: new Map(),
  });
  assert.equal(prediction.status, "insufficient-history");
  assert.equal(prediction.probabilities, null);
  assert.equal(prediction.independentFromMarket, true);
});

test("learning example rejects future leakage", () => {
  const feature = {
    id: "feature-1",
    event_id: "event-1",
    as_of: "2026-02-02T00:00:00.000Z",
    commence_time: "2026-02-01T15:00:00.000Z",
    feature_schema_version: "v1",
    input_hash: "input-hash",
    source_lineage: [{ sourceId: "openfootball_cc0", kind: "independent" }],
    leakage_guard_passed: true,
  };
  const outcome = {
    id: "outcome-1",
    outcome_hash: "outcome-hash",
    status: "final",
    finality_verified: true,
    outcome: "home",
    home_score: 2,
    away_score: 1,
    commence_time: "2026-02-01T15:00:00.000Z",
    resolved_at: "2026-02-01T17:00:00.000Z",
  };
  const example = buildLearningExample({
    featureSnapshot: feature,
    outcome,
    sourceRights: { openfootball_cc0: { modelTrainingAllowed: true } },
  });
  assert.equal(example.chronology_verified, false);
  assert.equal(example.eligible_for_training, false);
  assert.ok(example.exclusion_reasons.includes("chronology-not-verified"));
});
