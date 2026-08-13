import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildEventDetail } from "../lib/event-detail.mjs";

const client = fs.readFileSync(new URL("../app/match-intelligence/MatchIntelligenceClient.jsx", import.meta.url), "utf8");
const eventClient = fs.readFileSync(new URL("../app/event/[eventId]/EventDetailClient.jsx", import.meta.url), "utf8");
const mobileUi = fs.readFileSync(new URL("../mobile/src/ui.tsx", import.meta.url), "utf8");

function count(text, token) {
  return text.split(token).length - 1;
}

function pick(overrides = {}) {
  return {
    id: "pick-home",
    gameId: "event-123",
    sportKey: "icehockey_nhl",
    league: "icehockey_nhl",
    leagueTitle: "NHL",
    match: "Home Team – Away Team",
    homeTeam: "Home Team",
    awayTeam: "Away Team",
    selection: "Home Team",
    productDecision: "CAUTION",
    fixtureVerifiedByProvider: true,
    ...overrides
  };
}

test("Match Intelligence V2 keeps exactly one event-detail fetch", () => {
  assert.equal(count(client, "fetch("), 1);
  assert.match(client, /\/api\/event-detail/);
  assert.equal(client.includes("/api/data-layer"), false);
});

test("V2 uses shared language and professional mode providers", () => {
  assert.match(client, /useLanguage/);
  assert.match(client, /useProfessionalPreferences/);
  assert.match(client, /toggleProMode/);
  assert.match(client, /data-match-intelligence-mode-toggle/);
});

test("Evidence Semantics V2 distinguishes missing, zero observations and observed evidence", () => {
  const missing = buildEventDetail([pick()], "event-123");
  assert.equal(missing.evidenceSemanticsVersion, "scorecaster-evidence-semantics-v2");
  assert.equal(missing.sportsIntelligence.evidenceState, "missing");
  assert.equal(missing.sportsIntelligence.sourceCount, null);
  assert.equal(missing.featureEngine.evidenceState, "missing");
  assert.equal(missing.featureEngine.counts.total, null);
  assert.equal(missing.ensembleEngine.evidenceState, "missing");
  assert.equal(missing.ensembleEngine.counts.researchEligible, null);
  assert.equal(missing.formRestShadow.evidenceState, "missing");

  const zero = buildEventDetail([pick({
    sportsIntelligence: { readiness: { totalChecks: 0, verifiedCount: 0 }, sourceCount: 0, conflicts: [] },
    featureEngineV1: { counts: { total: 0, eligible: 0, missing: 0, rejected: 0 }, eligibilityRate: 0 },
    ensembleEngineV1: { counts: { supplied: 0, researchEligible: 0, calibrationReady: 0, rejected: 0 }, models: [] },
    formRestShadow: {
      status: "ready",
      home: { team: "Home Team", sampleSize: 0, gamesLast7Days: 0 },
      away: { team: "Away Team", sampleSize: 0, gamesLast7Days: 0 }
    }
  })], "event-123");
  assert.equal(zero.sportsIntelligence.evidenceState, "no-observations");
  assert.equal(zero.sportsIntelligence.sourceCount, 0);
  assert.equal(zero.featureEngine.evidenceState, "no-observations");
  assert.equal(zero.featureEngine.counts.total, 0);
  assert.equal(zero.ensembleEngine.evidenceState, "no-observations");
  assert.equal(zero.ensembleEngine.counts.researchEligible, 0);
  assert.equal(zero.formRestShadow.evidenceState, "no-observations");
  assert.equal(zero.formRestShadow.home.sampleSize, 0);

  const observed = buildEventDetail([pick({
    sportsIntelligence: { readiness: { totalChecks: 2, verifiedCount: 1 }, sourceCount: 1 },
    featureEngineV1: { counts: { total: 2, eligible: 1 }, eligibilityRate: 0.5 },
    ensembleEngineV1: { counts: { supplied: 1, researchEligible: 1 }, models: [{ modelId: "research-1", probability: 0.55 }] },
    formRestShadow: { status: "ready", home: { sampleSize: 5 }, away: { sampleSize: 5 } }
  })], "event-123");
  assert.equal(observed.sportsIntelligence.evidenceState, "observed");
  assert.equal(observed.featureEngine.evidenceState, "observed");
  assert.equal(observed.ensembleEngine.evidenceState, "observed");
  assert.equal(observed.formRestShadow.evidenceState, "observed");
});

test("selection evidence preserves explicit zero but never invents zero for missing metrics", () => {
  const missing = buildEventDetail([pick()], "event-123").selections[0];
  assert.equal(missing.odds, null);
  assert.equal(missing.edge, null);
  assert.equal(missing.ev, null);
  assert.equal(missing.confidence, null);
  assert.equal(missing.trustScore, null);
  assert.equal(missing.bookmakerCount, null);

  const zero = buildEventDetail([pick({ odds: 0, edge: 0, ev: 0, confidence: 0, trustScore: 0, bookmakerCount: 0 })], "event-123").selections[0];
  assert.equal(zero.odds, 0);
  assert.equal(zero.edge, 0);
  assert.equal(zero.ev, 0);
  assert.equal(zero.confidence, 0);
  assert.equal(zero.trustScore, 0);
  assert.equal(zero.bookmakerCount, 0);
});

test("Match Intelligence shows explicit evidence states rather than zero-imputing missing sections", () => {
  assert.match(client, /data-evidence-semantics-v2/);
  assert.match(client, /intelligenceState === "missing"/);
  assert.match(client, /featureState === "no-observations"/);
  assert.match(client, /ensembleState === "missing"/);
  assert.match(client, /0 verified observations/);
  assert.match(client, /Feature pipeline ran with 0 observations/);
  assert.match(client, /Model pipeline ran with 0 observations/);
  assert.match(client, /data-team-comparison/);
  assert.match(client, /data-model-room/);
  assert.match(client, /Independent research models/);
});

test("web and native formatters keep missing numeric evidence missing", () => {
  assert.match(eventClient, /function finite\(value\)/);
  assert.match(eventClient, /value === null \|\| value === undefined \|\| value === ""/);
  assert.match(eventClient, /data-evidence-semantics-v2/);
  assert.match(eventClient, /selectedOddsAvailable/);
  assert.match(eventClient, /verified odds are missing/i);
  assert.match(mobileUi, /if \(value === null \|\| value === undefined\) return "–"/);
  assert.match(mobileUi, /if \(!Number\.isFinite\(number\)\) return "–"/);
});

test("Pro-only model detail remains conditional", () => {
  assert.match(client, /proMode \?/);
  assert.match(client, /ModelRoom models=\{models\}/);
});

test("Match Intelligence links to event-specific Activity without adding a fetch", () => {
  assert.match(client, /data-match-activity-link/);
  assert.match(client, /\/market-timeline\?eventId=/);
  assert.equal(count(client, "fetch("), 1);
});

test("V2 preserves the read-only production boundary", () => {
  assert.equal(client.includes("method: \"POST\""), false);
  assert.equal(client.includes("method: 'POST'"), false);
  assert.match(client, /does not invent missing values, change production probabilities, or alter product decisions/);
  assert.match(client, /Market benchmark/);
  assert.match(client, /automatic promotion/);
});
