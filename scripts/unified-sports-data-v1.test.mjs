import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildUnifiedSportsDataLedger, applyUnifiedDataSafety } from "../lib/unified-sports-data-v1.mjs";
import { scoreNewsSource } from "../lib/news-source-reliability.mjs";
import {
  applyPregameEvidenceCoverage,
  calculatePregameEvidenceCoverage
} from "../lib/pregame-evidence-coverage-v1.mjs";
import { summarizeUnifiedCaptureSecondaryPricing } from "../lib/unified-capture-secondary-summary-v1.mjs";

const NOW = Date.parse("2026-07-22T12:00:00.000Z");

function basePick(overrides = {}) {
  return {
    id: "event-1",
    gameId: "event-1",
    match: "Home Club vs Away Club",
    homeTeam: "Home Club",
    awayTeam: "Away Club",
    selection: "Home Club",
    sportKey: "soccer_epl",
    leagueTitle: "Premier League",
    commenceTime: "2026-07-23T18:00:00.000Z",
    odds: 2.1,
    currentOdds: 2.1,
    openingOdds: 2.25,
    marketAverageOdds: 2.05,
    bookmakerCount: 7,
    confidence: 0.72,
    productDecision: "PLAY",
    decision: "BET",
    edge: 0.03,
    ev: 0.05,
    formRestShadow: {
      provider: { mode: "live", source: "results-provider", retrievedAt: "2026-07-22T11:00:00.000Z" },
      home: { team: "Home Club", sampleSize: 5, formStrength: 0.5, restHours: 96, gamesLast7Days: 2, backToBack: false },
      away: { team: "Away Club", sampleSize: 5, formStrength: -0.2, restHours: 48, gamesLast7Days: 3, backToBack: false },
      features: { homeFormAdvantage: 0.35 }
    },
    ...overrides
  };
}

function sportsReport(overrides = {}) {
  return {
    providerLive: { news: true, injuries: true, lineup: true },
    injuries: [],
    lineups: [{ team: "Home Club", side: "home", startersConfirmed: true, goalieConfirmed: false, keyPlayersAvailable: true, source: "lineup-provider", sourceType: "official_data_provider", sourceTrust: 0.9, observedAt: "2026-07-22T11:00:00.000Z", impact: 0.006 }],
    news: [{ title: "Home Club and Away Club team update", source: "League", sourceType: "official_league", url: "https://league.example/match", publishedAt: "2026-07-22T09:00:00.000Z" }],
    ...overrides
  };
}

function secondaryOdds() {
  return {
    ok: true,
    source: "sportsgameodds",
    mode: "live",
    retrievedAt: "2026-07-22T11:30:00.000Z",
    data: {
      home: { average: 2.08, best: 2.15, bookmakerCount: 8, latestAt: "2026-07-22T11:25:00.000Z" },
      away: { average: 1.86, best: 1.9, bookmakerCount: 8, latestAt: "2026-07-22T11:25:00.000Z" }
    }
  };
}

function context() {
  return {
    ok: true,
    source: "sports-context-provider",
    mode: "live",
    data: {
      source: "context-provider",
      sourceType: "official_data_provider",
      sourceTrust: 0.88,
      updatedAt: "2026-07-22T10:30:00.000Z",
      home: { startersConfirmed: true, startingPlayers: [{ name: "Player One", confirmed: true, importance: 2 }], schedule: { restHours: 96, gamesLast7Days: 2 }, travel: { distanceKm: 100, timeZonesCrossed: 0, roadGamesInTrip: 0 } },
      away: { startersConfirmed: true, startingPlayers: [{ name: "Player Two", confirmed: true, importance: 2 }], schedule: { restHours: 48, gamesLast7Days: 3 }, travel: { distanceKm: 1200, timeZonesCrossed: 1, roadGamesInTrip: 2 } }
    }
  };
}

test("unified ledger covers every requested data family and exposes AI provenance", () => {
  const ledger = buildUnifiedSportsDataLedger({
    pick: basePick(),
    sportsReport: sportsReport(),
    secondaryOdds: secondaryOdds(),
    context: context(),
    weather: { ok: true, source: "open-meteo", mode: "live", retrievedAt: "2026-07-22T11:00:00.000Z", data: { severity: 0.2, impact: -0.0024, reasons: ["moderate wind"] } },
    now: NOW
  });
  const keys = new Set(ledger.factors.map((item) => item.key));
  for (const key of ["odds-consensus", "injuries", "lineups-and-starters", "recent-form", "rest-and-congestion", "travel", "weather", "market-movement", "closing-odds", "news-reliability"]) assert.equal(keys.has(key), true);
  assert.equal(ledger.coverage.independentOddsProviders, 2);
  assert.equal(ledger.policy.contextProbabilityApplied, false);
  assert.equal(ledger.policy.canUpgradeProductionDecision, false);
  assert.ok(ledger.aiExplanation.dataUsed.length >= 7);
});

test("verified negative evidence can only downgrade PLAY and never changes probability", () => {
  const ledger = buildUnifiedSportsDataLedger({
    pick: basePick(),
    sportsReport: sportsReport({ injuries: [{ name: "Key Player", team: "Home Club", side: "home", status: "out", importance: 3, source: "sportsdata", sourceType: "official_data_provider", sourceTrust: 0.9, observedAt: "2026-07-22T10:00:00.000Z", impact: -0.04 }] }),
    secondaryOdds: secondaryOdds(),
    context: context(),
    now: NOW
  });
  const result = applyUnifiedDataSafety(basePick(), ledger);
  assert.equal(result.productDecision, "CAUTION");
  assert.equal(result.decision, "WATCH");
  assert.equal(result.unifiedDataSafetyDowngrade, true);
  assert.equal(result.probabilityAdjustedByUnifiedData, false);
  assert.equal(ledger.safetyRecommendation.upgraded, false);
});

test("positive context never upgrades CAUTION to PLAY", () => {
  const pick = basePick({ productDecision: "CAUTION", decision: "WATCH" });
  const ledger = buildUnifiedSportsDataLedger({ pick, sportsReport: sportsReport(), secondaryOdds: secondaryOdds(), context: context(), now: NOW });
  const result = applyUnifiedDataSafety(pick, ledger);
  assert.equal(result.productDecision, "CAUTION");
  assert.equal(result.decision, "WATCH");
  assert.equal(ledger.safetyRecommendation.upgraded, false);
});

test("closing odds remain post-event learning only", () => {
  const ledger = buildUnifiedSportsDataLedger({ pick: basePick({ closingOdds: 1.95, clv: 7.69 }), sportsReport: sportsReport(), now: NOW });
  const closing = ledger.factors.find((item) => item.key === "closing-odds");
  assert.equal(closing.usedByAi, false);
  assert.equal(closing.useMode, "training-and-calibration-only");
  assert.equal(closing.impact, 0);
  assert.equal(ledger.policy.closingOddsPregameLeakage, false);
});

test("pregame verified coverage excludes only non-applicable and training-only factors", () => {
  const factors = [
    { key: "odds-consensus", status: "verified", confidence: 0.9, trust: 0.9, usedByAi: true },
    { key: "rest-and-congestion", status: "verified", confidence: 0.8, trust: 0.8, usedByAi: true },
    { key: "injuries", status: "missing", confidence: 0, trust: 0, usedByAi: false },
    { key: "closing-odds", status: "verified", confidence: 1, trust: 1, usedByAi: false, useMode: "training-and-calibration-only" },
    { key: "weather", status: "not_applicable_indoor", confidence: 1, trust: 1, usedByAi: false }
  ];
  const coverage = calculatePregameEvidenceCoverage(factors);
  assert.equal(coverage.totalFamilies, 5);
  assert.equal(coverage.applicablePregameFamilies, 3);
  assert.equal(coverage.verifiedPregameFamilies, 2);
  assert.equal(coverage.applicableVerifiedCoverageRate, 0.667);
  assert.deepEqual(coverage.excludedFamilies.sort(), ["closing-odds", "weather"]);
  assert.equal(coverage.missingEvidenceStillCounts, true);
  assert.equal(coverage.thresholdsChanged, false);

  const ledger = applyPregameEvidenceCoverage({ coverage: { verifiedCoverageRate: 0.4 }, factors });
  assert.equal(ledger.coverage.verifiedCoverageRate, 0.667);
  assert.equal(ledger.coverage.missingEvidenceStillCounts, true);
});

test("pregame evidence rejects synthetic zero rest when no completed history was verified", () => {
  const factors = [
    {
      key: "recent-form",
      status: "insufficient-sample",
      confidence: 0,
      trust: 0.72,
      usedByAi: false,
      evidence: [{ sampleSize: 0 }]
    },
    {
      key: "rest-and-congestion",
      status: "ready",
      confidence: 0.72,
      trust: 0.72,
      usedByAi: true,
      impact: 0,
      evidence: [{ selectedRestHours: 0, opponentRestHours: 0 }],
      missing: []
    }
  ];

  const ledger = applyPregameEvidenceCoverage({ coverage: {}, factors });
  const rest = ledger.factors.find((factor) => factor.key === "rest-and-congestion");
  assert.equal(rest.status, "missing");
  assert.equal(rest.confidence, 0);
  assert.equal(rest.usedByAi, false);
  assert.equal(rest.evidenceGuard, "synthetic-zero-rest-rejected");
  assert.deepEqual(rest.missing, ["verified previous-game timestamps for both teams"]);
  assert.equal(ledger.coverage.syntheticZeroRestRejected, true);
  assert.equal(ledger.coverage.verifiedCoverageRate, 0);
});

test("secondary capture reports quota exhaustion without disguising it as repeated upstream failure", () => {
  const quotaProvider = {
    source: "sportsgameodds",
    mode: "api_error",
    quotaPreflightBlocked: true,
    usageRequestMade: true,
    eventRequestMade: false,
    upstream: { usage: { bindingLimits: ["per-month:entities"] } }
  };
  const summary = summarizeUnifiedCaptureSecondaryPricing([
    { unifiedDataProviders: { secondaryOdds: quotaProvider } },
    { unifiedDataProviders: { secondaryOdds: quotaProvider } },
    { unifiedDataProviders: { secondaryOdds: { source: "sportsgameodds", mode: "unsupported_league", usageRequestMade: false, eventRequestMade: false } } },
    { unifiedDataProviders: { secondaryOdds: { source: "sportsgameodds", mode: "timeout", quotaPreflightBlocked: false, usageRequestMade: false, eventRequestMade: true } } },
    { unifiedDataProviders: { secondaryOdds: { source: "sportsgameodds", mode: "live", usageRequestMade: true, eventRequestMade: true } } }
  ]);
  assert.equal(summary.requested, 5);
  assert.equal(summary.live, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.quotaBlocked, 2);
  assert.equal(summary.quotaExhausted, true);
  assert.deepEqual(summary.bindingLimits, ["per-month:entities"]);
  assert.equal(summary.unsupported, 1);
  assert.equal(summary.eventRequests, 2);
  assert.equal(summary.quotaBypassAttempted, false);
  assert.equal(summary.probabilityChanged, false);
  assert.equal(summary.paperOnly, true);
});

test("news reliability explains trust and blocks weak stale sources", () => {
  const trusted = scoreNewsSource({ sourceType: "official_league", source: "League", url: "https://league.example/news", publishedAt: "2026-07-22T10:00:00.000Z" }, { now: NOW, corroboratingSources: 2 });
  const weak = scoreNewsSource({ sourceType: "fan_forum", source: "Forum", url: "https://forum.example/post", publishedAt: "2026-07-15T10:00:00.000Z" }, { now: NOW, corroboratingSources: 1 });
  assert.equal(trusted.usableForDecision, true);
  assert.equal(weak.usableForExplanation, false);
  assert.ok(trusted.reasons.length >= 4);
});

test("unified data ships web API, cockpit, event provenance and native hub", async () => {
  const [service, api, page, component, mobile, more, env, loader, captureRoute] = await Promise.all([
    readFile(new URL("../lib/unified-sports-data-service.js", import.meta.url), "utf8"),
    readFile(new URL("../app/api/data-layer/route.js", import.meta.url), "utf8"),
    readFile(new URL("../app/data-layer/UnifiedDataLayerClient.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/UnifiedDataLedger.jsx", import.meta.url), "utf8"),
    readFile(new URL("../mobile/src/screens/DataLayerScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../mobile/src/screens/MoreScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../lib/agent-intelligence-loader.js", import.meta.url), "utf8"),
    readFile(new URL("../app/api/internal/unified-data/route.js", import.meta.url), "utf8")
  ]);
  assert.match(service, /fetchSportsGameOddsForMatch/);
  assert.match(service, /fetchWeatherForMatch/);
  assert.match(service, /applyPregameEvidenceCoverage/);
  assert.match(api, /contextCanUpgrade: false/);
  assert.match(page, /UnifiedDataLedger/);
  assert.match(component, /What data AI used and why/);
  assert.match(mobile, /AI USED/);
  assert.match(more, /DataLayerScreen/);
  assert.match(env, /SPORTSGAMEODDS_API_KEY/);
  assert.match(env, /SPORTS_CONTEXT_API_URL/);
  assert.match(loader, /applyUnifiedDataSafety/);
  assert.match(captureRoute, /summarizeUnifiedCaptureSecondaryPricing/);
  assert.doesNotMatch(captureRoute, /quotaBypass|ignoreQuota|forceSecondary/i);
});
