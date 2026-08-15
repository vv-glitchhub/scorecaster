import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeUnifiedOptionalNumerics,
  UNIFIED_OPTIONAL_NUMERIC_SANITIZER_POLICY
} from "../lib/unified-optional-numeric-sanitizer-v1.mjs";
import { buildUnifiedSportsDataLedgerWithLineupProvenance } from "../lib/unified-lineup-provenance-v1.mjs";

const NOW = Date.parse("2026-08-15T04:30:00Z");

function factor(ledger, key) {
  return ledger.factors.find((item) => item.key === key);
}

test("optional numeric sanitizer turns only missing numeric values into undefined", () => {
  const source = {
    formStrength: null,
    restHours: "",
    latitude: undefined,
    severity: null,
    temperatureC: 0,
    gamesLast7Days: 0,
    nested: {
      distanceKm: null,
      confidence: "",
      nonNumericState: null,
      label: ""
    }
  };
  const sanitized = sanitizeUnifiedOptionalNumerics(source);

  assert.equal(sanitized.formStrength, undefined);
  assert.equal(sanitized.restHours, undefined);
  assert.equal(sanitized.latitude, undefined);
  assert.equal(sanitized.severity, undefined);
  assert.equal(sanitized.nested.distanceKm, undefined);
  assert.equal(sanitized.nested.confidence, undefined);
  assert.equal(sanitized.temperatureC, 0);
  assert.equal(sanitized.gamesLast7Days, 0);
  assert.equal(sanitized.nested.nonNumericState, null);
  assert.equal(sanitized.nested.label, "");
  assert.equal(UNIFIED_OPTIONAL_NUMERIC_SANITIZER_POLICY.numericZeroPreserved, true);
  assert.equal(UNIFIED_OPTIONAL_NUMERIC_SANITIZER_POLICY.paperOnly, true);
});

test("missing form and rest numerics cannot become available zero-valued Unified Data evidence", () => {
  const pick = {
    id: "evt-null-unified",
    gameId: "evt-null-unified",
    sportKey: "basketball_wnba",
    league: "WNBA",
    homeTeam: "Home Team",
    awayTeam: "Away Team",
    selection: "Home Team",
    commenceTime: "2026-08-16T18:00:00Z",
    odds: 2,
    bookmakerCount: 8,
    modelProbability: 0.5,
    consensusProbability: 0.5,
    productDecision: "CAUTION",
    decision: "WATCH",
    formRestShadow: {
      status: "insufficient_history",
      mode: "feature-only",
      home: {
        sampleSize: 0,
        formStrength: null,
        normalizedScoreMargin: null,
        lastPlayedAt: null,
        restHours: null,
        restDays: null,
        gamesLast7Days: 0,
        gamesLast14Days: 0
      },
      away: {
        sampleSize: 0,
        formStrength: null,
        normalizedScoreMargin: null,
        lastPlayedAt: null,
        restHours: "",
        restDays: undefined,
        gamesLast7Days: 0,
        gamesLast14Days: 0
      }
    }
  };

  const ledger = buildUnifiedSportsDataLedgerWithLineupProvenance({ pick, sportsReport: {}, now: NOW });
  const form = factor(ledger, "recent-form");
  const rest = factor(ledger, "rest-and-congestion");

  assert.equal(form.status, "not-verified");
  assert.equal(form.usedByAi, false);
  assert.equal(form.confidence, 0);
  assert.equal(rest.status, "missing");
  assert.equal(rest.usedByAi, false);
  assert.equal(rest.confidence, 0);
  assert.equal(rest.impact, 0);
});

test("real numeric zero still survives the Unified Data wrapper", () => {
  const pick = {
    id: "evt-zero-unified",
    gameId: "evt-zero-unified",
    sportKey: "soccer_usa_mls",
    league: "MLS",
    homeTeam: "Home Team",
    awayTeam: "Away Team",
    selection: "Home Team",
    commenceTime: "2026-08-16T18:00:00Z",
    odds: 2,
    bookmakerCount: 8,
    modelProbability: 0.5,
    consensusProbability: 0.5,
    productDecision: "CAUTION",
    decision: "WATCH",
    formRestShadow: {
      status: "feature_only",
      mode: "feature-only",
      home: { sampleSize: 3, formStrength: 0, restHours: 72, gamesLast7Days: 0, gamesLast14Days: 3 },
      away: { sampleSize: 3, formStrength: 0, restHours: 72, gamesLast7Days: 0, gamesLast14Days: 3 }
    }
  };

  const sanitized = sanitizeUnifiedOptionalNumerics(pick);
  assert.equal(sanitized.formRestShadow.home.formStrength, 0);
  assert.equal(sanitized.formRestShadow.away.formStrength, 0);
  assert.equal(sanitized.formRestShadow.home.gamesLast7Days, 0);
  const ledger = buildUnifiedSportsDataLedgerWithLineupProvenance({ pick, sportsReport: {}, now: NOW });
  const form = factor(ledger, "recent-form");
  assert.notEqual(form.status, "not-verified");
});
