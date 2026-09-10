import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { selectLatestEligiblePregameFeatures } from "../lib/learning-feature-selection.mjs";
import { OWNED_FOOTBALL_LEAGUES } from "../lib/active-market-universe.js";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function feature(overrides = {}) {
  return {
    event_id: "event-1",
    sport_key: "soccer_epl",
    commence_time: "2026-09-10T18:00:00.000Z",
    as_of: "2026-09-10T17:00:00.000Z",
    eligible_for_model: true,
    leakage_guard_passed: true,
    data_quality: { hasIndependentSignal: true },
    ...overrides
  };
}

test("learning selection keeps the latest valid pregame snapshot, never a later post-start snapshot", () => {
  const rows = [
    feature({ id: "pregame-old", as_of: "2026-09-10T16:00:00.000Z" }),
    feature({ id: "post-start", as_of: "2026-09-10T18:05:00.000Z", eligible_for_model: false, leakage_guard_passed: false }),
    feature({ id: "pregame-latest", as_of: "2026-09-10T17:55:00.000Z" })
  ];
  const selected = selectLatestEligiblePregameFeatures(rows, {
    now: Date.parse("2026-09-10T20:00:00.000Z"),
    leagues: OWNED_FOOTBALL_LEAGUES
  });
  assert.equal(selected.length, 1);
  assert.equal(selected[0].id, "pregame-latest");
});

test("learning selection rejects future events, unsupported leagues and leakage failures", () => {
  const selected = selectLatestEligiblePregameFeatures([
    feature({ id: "future", event_id: "future", commence_time: "2026-09-11T18:00:00.000Z" }),
    feature({ id: "mls", event_id: "mls", sport_key: "soccer_usa_mls" }),
    feature({ id: "leak", event_id: "leak", leakage_guard_passed: false }),
    feature({ id: "not-eligible", event_id: "not-eligible", eligible_for_model: false })
  ], {
    now: Date.parse("2026-09-10T20:00:00.000Z"),
    leagues: OWNED_FOOTBALL_LEAGUES
  });
  assert.deepEqual(selected, []);
});

test("intelligence core reads recent outcomes and uses chronology-safe learning selection", async () => {
  const route = await source("app/api/internal/intelligence-core/route.js");
  assert.match(route, /OWNED_FOOTBALL_LEAGUES/);
  assert.match(route, /selectLatestEligiblePregameFeatures/);
  assert.match(route, /order\("commence_time", \{ ascending: false \}\)\.limit\(15000\)/);
  assert.match(route, /learningCandidates/);
  assert.match(route, /learningMatchedOutcomes/);
  assert.doesNotMatch(route, /order\("commence_time", \{ ascending: true \}\)\.limit\(15000\)/);
});
