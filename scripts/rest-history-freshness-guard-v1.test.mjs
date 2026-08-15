import test from "node:test";
import assert from "node:assert/strict";
import { applyRestHistoryFreshnessGuardV1 } from "../lib/rest-history-freshness-guard-v1.mjs";
import { buildUnifiedSportsDataLedger } from "../lib/unified-sports-data-v1.mjs";

const KICKOFF = "2026-08-15T17:00:00Z";
const NOW = Date.parse("2026-08-15T03:45:00Z");

function side(overrides = {}) {
  return {
    team: "Team",
    sampleSize: 1,
    formStrength: 0.2,
    normalizedScoreMargin: 0.1,
    lastPlayedAt: "2026-08-13T17:00:00Z",
    restHours: 48,
    restDays: 2,
    restScore: 0,
    backToBack: false,
    gamesLast7Days: 1,
    gamesLast14Days: 2,
    congestionScore: 0,
    ...overrides
  };
}

function pick(overrides = {}) {
  return {
    id: "event-1",
    gameId: "event-1",
    sportKey: "basketball_wnba",
    league: "WNBA",
    homeTeam: "Home Team",
    awayTeam: "Away Team",
    selection: "Home Team",
    commenceTime: KICKOFF,
    odds: 2,
    bookmakerCount: 8,
    confidence: 0.6,
    modelProbability: 0.5,
    consensusProbability: 0.5,
    edge: 0.03,
    ev: 0.04,
    decision: "WATCH",
    productDecision: "CAUTION",
    formRestShadow: {
      version: "form-rest-shadow-v1",
      sportKey: "basketball_wnba",
      asOf: KICKOFF,
      provider: { source: "thesportsdb", mode: "live", retrievedAt: "2026-08-15T03:44:00Z" },
      home: side({ team: "Home Team" }),
      away: side({ team: "Away Team", lastPlayedAt: "2026-08-12T17:00:00Z", restHours: 72, restDays: 3 }),
      features: { homeFormAdvantage: 0.1, homeMarginAdvantage: 0.1, homeRestAdvantage: -0.1, homeCongestionAdvantage: 0 }
    },
    featureSnapshot: {
      home: side({ team: "Home Team" }),
      away: side({ team: "Away Team", lastPlayedAt: "2026-08-12T17:00:00Z", restHours: 72, restDays: 3 }),
      features: { homeFormAdvantage: 0.1, homeMarginAdvantage: 0.1, homeRestAdvantage: -0.1, homeCongestionAdvantage: 0 }
    },
    ...overrides
  };
}

function restFactor(guarded) {
  const ledger = buildUnifiedSportsDataLedger({ pick: guarded, sportsReport: {}, now: NOW });
  return ledger.factors.find((item) => item.key === "rest-and-congestion");
}

test("fresh verified rest for both teams remains usable and decision fields are unchanged", () => {
  const source = pick();
  const guarded = applyRestHistoryFreshnessGuardV1(source, { now: NOW });
  assert.equal(guarded.restHistoryFreshness.status, "ready");
  assert.equal(guarded.restHistoryFreshness.restEvidenceUsable, true);
  assert.equal(guarded.formRestShadow.home.restHours, 48);
  assert.equal(guarded.formRestShadow.away.restHours, 72);
  assert.equal(restFactor(guarded).status, "ready");
  assert.equal(restFactor(guarded).usedByAi, true);
  for (const field of ["modelProbability", "consensusProbability", "edge", "ev", "decision", "productDecision"]) {
    assert.equal(guarded[field], source[field]);
  }
});

test("months-old WNBA history is stale and cannot become rest evidence", () => {
  const source = pick({
    formRestShadow: {
      ...pick().formRestShadow,
      home: side({ team: "Home Team", lastPlayedAt: "2026-04-29T23:00:00Z", restHours: 2586 }),
      away: side({ team: "Away Team", lastPlayedAt: "2026-04-25T19:00:00Z", restHours: 2686 })
    }
  });
  const guarded = applyRestHistoryFreshnessGuardV1(source, { now: NOW });
  assert.equal(guarded.restHistoryFreshness.status, "stale-history");
  assert.equal(guarded.restHistoryFreshness.restEvidenceUsable, false);
  assert.equal(guarded.formRestShadow.home.restHours, undefined);
  assert.equal(guarded.formRestShadow.away.restHours, undefined);
  const factor = restFactor(guarded);
  assert.equal(factor.status, "missing");
  assert.equal(factor.usedByAi, false);
  assert.equal(factor.confidence, 0);
  assert.equal(factor.impact, 0);
});

test("missing opponent history cannot be represented as zero-hour rest", () => {
  const source = pick({
    sportKey: "soccer_sweden_allsvenskan",
    league: "Allsvenskan",
    formRestShadow: {
      ...pick().formRestShadow,
      sportKey: "soccer_sweden_allsvenskan",
      home: side({ team: "Home Team", lastPlayedAt: null, restHours: 0, restDays: 0 }),
      away: side({ team: "Away Team", lastPlayedAt: "2026-08-10T17:00:00Z", restHours: 120, restDays: 5 })
    }
  });
  const guarded = applyRestHistoryFreshnessGuardV1(source, { now: NOW });
  assert.equal(guarded.restHistoryFreshness.status, "insufficient-history");
  assert.equal(guarded.restHistoryFreshness.home.status, "insufficient-history");
  assert.equal(guarded.formRestShadow.home.restHours, undefined);
  assert.equal(guarded.formRestShadow.away.restHours, undefined);
  assert.equal(restFactor(guarded).status, "missing");
  assert.equal(restFactor(guarded).usedByAi, false);
});

test("reported rest must agree with the real last-played timestamp", () => {
  const source = pick({
    sportKey: "soccer_usa_mls",
    league: "MLS",
    formRestShadow: {
      ...pick().formRestShadow,
      sportKey: "soccer_usa_mls",
      home: side({ team: "Home Team", lastPlayedAt: "2026-08-13T17:00:00Z", restHours: 0 }),
      away: side({ team: "Away Team", lastPlayedAt: "2026-08-12T17:00:00Z", restHours: 72 })
    }
  });
  const guarded = applyRestHistoryFreshnessGuardV1(source, { now: NOW });
  assert.equal(guarded.restHistoryFreshness.status, "unverified-rest");
  assert.equal(guarded.restHistoryFreshness.home.restMatchesHistory, false);
  assert.equal(restFactor(guarded).usedByAi, false);
});

test("guard leaves form evidence intact while scrubbing only invalid rest/congestion fields", () => {
  const source = pick({
    sportKey: "soccer_sweden_allsvenskan",
    league: "Allsvenskan",
    formRestShadow: {
      ...pick().formRestShadow,
      sportKey: "soccer_sweden_allsvenskan",
      home: side({ team: "Home Team", sampleSize: 1, formStrength: 1, lastPlayedAt: "2026-04-03T12:00:00Z", restHours: 3221 }),
      away: side({ team: "Away Team", sampleSize: 0, formStrength: null, lastPlayedAt: null, restHours: 0 })
    }
  });
  const guarded = applyRestHistoryFreshnessGuardV1(source, { now: NOW });
  assert.equal(guarded.formRestShadow.home.sampleSize, 1);
  assert.equal(guarded.formRestShadow.home.formStrength, 1);
  assert.equal(guarded.formRestShadow.away.sampleSize, 0);
  assert.equal(guarded.formRestShadow.away.formStrength, null);
  assert.equal(guarded.formRestShadow.home.restHours, undefined);
  assert.equal(guarded.formRestShadow.home.gamesLast7Days, undefined);
  assert.equal(guarded.featureSnapshot.home.restHours, undefined);
  assert.equal(guarded.featureSnapshot.features.homeRestAdvantage, undefined);
  assert.equal(guarded.restHistoryFreshness.probabilityChanged, false);
  assert.equal(guarded.restHistoryFreshness.decisionChanged, false);
  assert.equal(guarded.restHistoryFreshness.paperOnly, true);
});
