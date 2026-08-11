import test from "node:test";
import assert from "node:assert/strict";
import { buildHistoricalRatingShadow, HISTORICAL_RATING_SHADOW_VERSION } from "../lib/historical-rating-shadow-model.mjs";

const NOW = Date.parse("2026-08-11T09:00:00.000Z");
const FIXTURE = "2026-08-11T18:00:00.000Z";

function pick(overrides = {}) {
  return {
    gameId: "event-target",
    sportKey: "icehockey_nhl",
    league: "icehockey_nhl",
    homeTeam: "Home",
    awayTeam: "Away",
    selection: "Home",
    commenceTime: FIXTURE,
    ...overrides
  };
}

function event(index, homeTeam, awayTeam, homeScore, awayScore, dateOffset = index) {
  const timestamp = new Date(Date.parse("2026-07-01T18:00:00.000Z") + dateOffset * 12 * 60 * 60 * 1000).toISOString();
  return {
    id: `result-${index}`,
    commence_time: timestamp,
    home_team: homeTeam,
    away_team: awayTeam,
    home_score: homeScore,
    away_score: awayScore,
    is_finished: true
  };
}

function history() {
  const rows = [];
  for (let index = 0; index < 32; index += 1) {
    if (index % 4 === 0) rows.push(event(index, "Home", `Team ${index}`, 4, 2));
    else if (index % 4 === 1) rows.push(event(index, `Team ${index}`, "Away", 3, 2));
    else if (index % 4 === 2) rows.push(event(index, "Away", `Team ${index}`, 2, 4));
    else rows.push(event(index, `Team ${index}`, "Home", 1, 3));
  }
  return {
    ok: true,
    source: "thesportsdb",
    mode: "live",
    leagueKey: "NHL",
    retrievedAt: "2026-08-11T08:58:00.000Z",
    resultCount: rows.length,
    results: rows
  };
}

test("Historical Rating Shadow V1 is deterministic for the same pre-event history", () => {
  const first = buildHistoricalRatingShadow({ pick: pick(), provider: history(), now: NOW });
  const second = buildHistoricalRatingShadow({ pick: pick(), provider: history(), now: NOW });

  assert.equal(first.version, HISTORICAL_RATING_SHADOW_VERSION);
  assert.equal(first.status, "ready");
  assert.equal(first.modelId, "nhl-recent-elo-v1");
  assert.equal(first.shadowProbability, second.shadowProbability);
  assert.deepEqual(first.ratings, second.ratings);
  assert.equal(first.trainingUsesOnlyCompletedEventsBeforeFixture, true);
  assert.equal(first.probabilityAppliedToProduction, false);
  assert.equal(first.paperOnly, true);
});

test("post-fixture results cannot leak into Historical Rating Shadow V1", () => {
  const baseline = history();
  const withFuture = history();
  withFuture.results.push({
    id: "future-blowout",
    commence_time: "2026-08-12T18:00:00.000Z",
    home_team: "Away",
    away_team: "Home",
    home_score: 20,
    away_score: 0,
    is_finished: true
  });
  withFuture.resultCount += 1;

  const before = buildHistoricalRatingShadow({ pick: pick(), provider: baseline, now: NOW });
  const after = buildHistoricalRatingShadow({ pick: pick(), provider: withFuture, now: NOW });

  assert.equal(after.shadowProbability, before.shadowProbability);
  assert.deepEqual(after.ratings, before.ratings);
  assert.equal(after.sample.leagueEvents, before.sample.leagueEvents);
});

test("away selection is the complement of the same home rating probability", () => {
  const provider = history();
  const home = buildHistoricalRatingShadow({ pick: pick({ selection: "Home" }), provider, now: NOW });
  const away = buildHistoricalRatingShadow({ pick: pick({ selection: "Away" }), provider, now: NOW });

  assert.equal(home.status, "ready");
  assert.equal(away.status, "ready");
  assert.equal(Number((home.shadowProbability + away.shadowProbability).toFixed(6)), 1);
});

test("Historical Rating Shadow fails closed when the result source is unavailable", () => {
  const result = buildHistoricalRatingShadow({
    pick: pick(),
    provider: { ok: false, source: "thesportsdb", mode: "provider_error", results: [] },
    now: NOW
  });

  assert.equal(result.status, "source_unavailable");
  assert.equal(result.shadowProbability, null);
  assert.equal(result.usedForDecision, false);
});

test("Historical Rating Shadow requires enough league and team history", () => {
  const provider = history();
  provider.results = provider.results.slice(0, 8);
  provider.resultCount = provider.results.length;
  const result = buildHistoricalRatingShadow({ pick: pick(), provider, now: NOW });

  assert.equal(result.status, "insufficient_history");
  assert.equal(result.shadowProbability, null);
});

test("unsupported sports remain visible without manufacturing a probability", () => {
  const result = buildHistoricalRatingShadow({
    pick: pick({ sportKey: "soccer_epl", league: "soccer_epl" }),
    provider: history(),
    now: NOW
  });

  assert.equal(result.status, "unsupported_sport");
  assert.equal(result.shadowProbability, null);
  assert.equal(result.probabilityAppliedToProduction, false);
});
