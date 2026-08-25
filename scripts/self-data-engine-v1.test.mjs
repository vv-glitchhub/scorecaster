import assert from "node:assert/strict";
import {
  PIT_FEATURE_SCHEMA_VERSION,
  buildPointInTimeFeatureSnapshot,
  buildAutonomousDecision,
  stableHash,
} from "../lib/self-data-engine-v1.mjs";

const asOf = "2026-08-25T09:00:00.000Z";
const kickoff = "2026-08-25T18:00:00.000Z";
const pick = {
  gameId: "event-1",
  sportKey: "soccer_england_premier_league",
  leagueTitle: "Premier League",
  homeTeam: "Home FC",
  awayTeam: "Away FC",
  commenceTime: kickoff,
  decision: "PLAY",
  selection: "Home FC",
  probability: 0.55,
  marketProbability: 0.50,
  edge: 0.05,
  ev: 0.08,
  confidence: 0.82,
  score: 78,
  bookmakerCount: 8,
  intelligenceReadiness: { level: "partial", score: 0.7 },
};

const collectorRows = [{
  event_id: "event-1",
  entity_id: null,
  source_id: "the_odds_api",
  metric: "fixture_snapshot",
  value: null,
  observed_at: "2026-08-25T08:55:00.000Z",
  collected_at: "2026-08-25T08:56:00.000Z",
  commercial_use_allowed: true,
  publishable: true,
  payload: {},
}];

const observationRows = [{
  event_id: "event-1",
  participant_id: "Home FC",
  family: "expected-performance",
  metric: "xg_for_per_90",
  value: 1.65,
  observed_at: "2026-08-24T20:00:00.000Z",
  captured_at: "2026-08-25T08:50:00.000Z",
  provider: "scorecaster-internal",
}];

const snapshot = buildPointInTimeFeatureSnapshot({ pick, collectorRows, observationRows, asOf });
assert.equal(snapshot.feature_schema_version, PIT_FEATURE_SCHEMA_VERSION);
assert.equal(snapshot.event_id, "event-1");
assert.equal(snapshot.leakage_guard_passed, true);
assert.equal(snapshot.eligible_for_model, true);
assert.equal(snapshot.data_quality.hasMarketAnchor, true);
assert.equal(snapshot.data_quality.hasIndependentSignal, true);
assert.equal(snapshot.paper_only, true);
assert.match(snapshot.input_hash, /^[a-f0-9]{64}$/);

const repeated = buildPointInTimeFeatureSnapshot({ pick, collectorRows, observationRows, asOf });
assert.equal(repeated.input_hash, snapshot.input_hash, "same point-in-time inputs must hash identically");
assert.equal(stableHash({ b: 2, a: 1 }), stableHash({ a: 1, b: 2 }), "hashing must be key-order deterministic");

const decision = buildAutonomousDecision({ pick, featureSnapshot: snapshot, featureSnapshotId: "00000000-0000-0000-0000-000000000001", asOf });
assert.equal(decision.decision, "PLAY");
assert.equal(decision.automatic_upgrade_by_self_data_layer, false);
assert.equal(decision.production_probability_changed, false);
assert.equal(decision.real_money_action_available, false);
assert.equal(decision.paper_only, true);

const insufficient = buildPointInTimeFeatureSnapshot({ pick, collectorRows: [], observationRows: [], asOf });
const downgraded = buildAutonomousDecision({ pick, featureSnapshot: insufficient, featureSnapshotId: "00000000-0000-0000-0000-000000000002", asOf });
assert.equal(insufficient.eligible_for_model, false);
assert.equal(downgraded.decision, "CAUTION", "self-data layer may downgrade PLAY when inputs are insufficient");
assert.ok(downgraded.reason_codes.includes("self-data-insufficient-for-play"));

const futureObservation = [{
  ...observationRows[0],
  observed_at: "2026-08-25T19:00:00.000Z",
  captured_at: "2026-08-25T19:01:00.000Z",
}];
const contaminated = buildPointInTimeFeatureSnapshot({ pick, collectorRows, observationRows: futureObservation, asOf });
assert.equal(contaminated.leakage_guard_passed, false, "future rows must fail the chronology audit");
const skipped = buildAutonomousDecision({ pick, featureSnapshot: contaminated, featureSnapshotId: "00000000-0000-0000-0000-000000000003", asOf });
assert.equal(skipped.decision, "SKIP", "chronology failure must fail closed");
assert.ok(skipped.reason_codes.includes("point-in-time-leakage-guard-failed"));

const cautionPick = { ...pick, decision: "CAUTION" };
const caution = buildAutonomousDecision({ pick: cautionPick, featureSnapshot: snapshot, featureSnapshotId: "00000000-0000-0000-0000-000000000004", asOf });
assert.equal(caution.decision, "CAUTION", "self-data layer must never upgrade CAUTION to PLAY");

console.log("self-data-engine-v1: ok");
