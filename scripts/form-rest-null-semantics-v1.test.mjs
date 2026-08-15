import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFormRestShadowSnapshot,
  compactFormRestFeatureSnapshot
} from "../lib/form-rest-shadow-model.mjs";

const NOW = Date.parse("2026-08-15T04:30:00Z");
const KICKOFF = "2026-08-16T18:00:00Z";

function pick(overrides = {}) {
  return {
    id: "evt-null",
    gameId: "evt-null",
    sportKey: "basketball_wnba",
    league: "basketball_wnba",
    homeTeam: "Home Team",
    awayTeam: "Away Team",
    selection: "Home Team",
    commenceTime: KICKOFF,
    consensusProbability: 0.5,
    modelProbability: 0.5,
    ...overrides
  };
}

test("missing history stays null instead of becoming numeric zero", () => {
  const snapshot = buildFormRestShadowSnapshot({
    pick: pick(),
    provider: { ok: true, source: "thesportsdb", mode: "live", results: [] },
    now: NOW
  });

  assert.equal(snapshot.status, "insufficient_history");
  for (const side of [snapshot.home, snapshot.away]) {
    assert.equal(side.sampleSize, 0);
    assert.equal(side.weightedResultRate, null);
    assert.equal(side.formStrength, null);
    assert.equal(side.normalizedScoreMargin, null);
    assert.equal(side.lastPlayedAt, null);
    assert.equal(side.restHours, null);
    assert.equal(side.restDays, null);
    assert.equal(side.restScore, null);
    assert.equal(side.backToBack, false);
  }
  assert.equal(snapshot.features.homeFormAdvantage, null);
  assert.equal(snapshot.features.homeMarginAdvantage, null);
  assert.equal(snapshot.features.homeRestAdvantage, null);
  assert.equal(snapshot.shadowProbability, null);
  assert.equal(snapshot.probabilityAppliedToProduction, false);
  assert.equal(snapshot.usedForDecision, false);
});

test("compact snapshot preserves missing optional numerics as null", () => {
  const compact = compactFormRestFeatureSnapshot({
    modelId: "null-test",
    mode: "feature-only",
    status: "insufficient_history",
    sportKey: "basketball_wnba",
    provider: { source: "thesportsdb", mode: "live", resultCount: 0 },
    home: {
      team: "Home Team",
      sampleSize: 0,
      weightedResultRate: null,
      formStrength: null,
      normalizedScoreMargin: null,
      lastPlayedAt: null,
      restHours: null,
      restDays: null,
      gamesLast7Days: 0,
      gamesLast14Days: 0
    },
    away: {
      team: "Away Team",
      sampleSize: 0,
      weightedResultRate: undefined,
      formStrength: undefined,
      normalizedScoreMargin: "",
      lastPlayedAt: null,
      restHours: undefined,
      restDays: "",
      gamesLast7Days: 0,
      gamesLast14Days: 0
    },
    features: {
      homeFormAdvantage: null,
      homeMarginAdvantage: undefined,
      homeRestAdvantage: "",
      homeCongestionAdvantage: 0
    },
    shadowProbability: null,
    shadowConfidence: 0,
    marketProbability: 0.5,
    probabilityDelta: null
  });

  assert.equal(compact.home.weightedResultRate, null);
  assert.equal(compact.home.formStrength, null);
  assert.equal(compact.home.normalizedScoreMargin, null);
  assert.equal(compact.home.restHours, null);
  assert.equal(compact.home.restDays, null);
  assert.equal(compact.away.weightedResultRate, null);
  assert.equal(compact.away.formStrength, null);
  assert.equal(compact.away.normalizedScoreMargin, null);
  assert.equal(compact.away.restHours, null);
  assert.equal(compact.away.restDays, null);
  assert.equal(compact.features.homeFormAdvantage, null);
  assert.equal(compact.features.homeMarginAdvantage, null);
  assert.equal(compact.features.homeRestAdvantage, null);
  assert.equal(compact.features.homeCongestionAdvantage, 0);
  assert.equal(compact.shadowProbability, null);
  assert.equal(compact.shadowConfidence, 0);
  assert.equal(compact.marketProbability, 0.5);
  assert.equal(compact.probabilityDelta, null);
});

test("legitimate zero scores and zero-valued features remain zero", () => {
  const snapshot = buildFormRestShadowSnapshot({
    pick: pick({ sportKey: "soccer_usa_mls", league: "soccer_usa_mls" }),
    provider: {
      ok: true,
      source: "thesportsdb",
      mode: "live",
      results: [
        { id: "1", date: "2026-08-13", time: "18:00:00", home_team: "Home Team", away_team: "A", home_score: 0, away_score: 0, is_finished: true },
        { id: "2", date: "2026-08-12", time: "18:00:00", home_team: "Away Team", away_team: "B", home_score: 0, away_score: 0, is_finished: true }
      ]
    },
    now: NOW
  });

  assert.equal(snapshot.home.recentResults[0].scoreFor, 0);
  assert.equal(snapshot.home.recentResults[0].scoreAgainst, 0);
  assert.equal(snapshot.away.recentResults[0].scoreFor, 0);
  assert.equal(snapshot.away.recentResults[0].scoreAgainst, 0);
  assert.equal(snapshot.home.weightedResultRate, 0.5);
  assert.equal(snapshot.away.weightedResultRate, 0.5);
  assert.equal(snapshot.home.formStrength, 0);
  assert.equal(snapshot.away.formStrength, 0);
});
