import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildCurrentWindowLeagueReadiness,
  buildOpportunityRadar,
  buildScoreDecomposition,
  enrichRecommendationIntelligence
} from "../lib/recommendation-intelligence-v2.mjs";
import { buildRecommendationFeed } from "../lib/recommendation-engine.mjs";

function item(overrides = {}) {
  return {
    rank: 1,
    decision: "CAUTION",
    score: 75,
    eventId: "event-1",
    sportKey: "soccer_epl",
    league: "Premier League",
    selection: "Home FC",
    odds: 2.2,
    fairOdds: 2.05,
    minimumEvOdds: 2.112,
    evPriceGateOpen: true,
    edge: 0.025,
    ev: 0.06,
    confidence: 0.72,
    trustScore: 82,
    bookmakerCount: 10,
    freshness: "fresh",
    readiness: "market-only",
    nextGate: { code: "verified-evidence", status: "blocked" },
    ...overrides
  };
}

test("Near PLAY requires exactly one visible failed gate matching nextGate", () => {
  const intelligence = enrichRecommendationIntelligence(item());
  assert.equal(intelligence.nearPlay, true);
  assert.equal(intelligence.nearPlayGate, "verified-evidence");
  assert.equal(intelligence.visibleGateSummary.passed, 5);
  assert.equal(intelligence.visibleGateSummary.failed, 1);
  assert.equal(intelligence.finalSafetyStillRequired, true);
  assert.equal(intelligence.decisionUpgradeAllowedByThisLayer, false);
  assert.equal(intelligence.probabilityAdjustedByThisLayer, false);
});

test("two blocked gates never get mislabeled as Near PLAY", () => {
  const intelligence = enrichRecommendationIntelligence(item({ edge: 0.015, nextGate: { code: "edge", status: "blocked" } }));
  assert.equal(intelligence.visibleGateSummary.failed, 2);
  assert.equal(intelligence.nearPlay, false);
  assert.equal(intelligence.oneVisibleGateAway, false);
});

test("score decomposition preserves CAUTION decision ceiling", () => {
  const decomposition = buildScoreDecomposition(item({ edge: 0.06, ev: 0.2, confidence: 1, trustScore: 100, bookmakerCount: 30, readiness: "verified", score: 79 }));
  assert.equal(decomposition.decisionCeiling, 79);
  assert.ok(decomposition.rawScore > 79);
  assert.equal(decomposition.ceilingApplied, true);
  assert.equal(decomposition.displayedScore, 79);
});

test("Opportunity Radar is an ordering layer only", () => {
  const radar = buildOpportunityRadar([
    item({ eventId: "a", score: 76 }),
    item({ eventId: "b", score: 70, edge: 0.01, nextGate: { code: "edge" } })
  ]);
  assert.equal(radar.paperOnly, true);
  assert.equal(radar.realMoneyActionAvailable, false);
  assert.equal(radar.opportunities[0].decision, "CAUTION");
  assert.equal(radar.opportunities[0].intelligenceV2.decisionUpgradeAllowedByThisLayer, false);
});

test("current-window league readiness is explicitly not a historical rating", () => {
  const rows = buildCurrentWindowLeagueReadiness([
    item({ league: "Example League", readiness: "market-only", bookmakerCount: 12, confidence: 0.8 }),
    item({ league: "Example League", eventId: "event-2", readiness: "market-only", bookmakerCount: 11, confidence: 0.78 })
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "partial");
  assert.equal(rows[0].sampleSize, 2);
  assert.match(rows[0].limitation, /current live recommendation window/i);
  assert.match(rows[0].limitation, /not a historical/i);
});

test("Recommendation feed V2 exposes Near PLAY, radar and league readiness without changing decisions", () => {
  const feed = buildRecommendationFeed([{
    eventId: "feed-event",
    sportKey: "soccer_epl",
    leagueTitle: "Premier League",
    match: "Home FC – Away FC",
    selection: "Home FC",
    productDecision: "CAUTION",
    odds: 2.2,
    fairOdds: 2.05,
    edge: 0.025,
    ev: 0.06,
    confidence: 0.72,
    trustScore: 82,
    bookmakerCount: 10,
    freshnessLabel: "fresh",
    sportsIntelligence: { readiness: { level: "market-only" } }
  }], { limit: 8 });
  assert.equal(feed.version, "scorecaster-recommendation-feed-v2");
  assert.equal(feed.counts.CAUTION, 1);
  assert.equal(feed.counts.PLAY, 0);
  assert.equal(feed.counts.NEAR_PLAY, 1);
  assert.equal(feed.nearPlay[0].decision, "CAUTION");
  assert.equal(feed.opportunityRadar.realMoneyActionAvailable, false);
  assert.equal(feed.recommendations[0].intelligenceV2.decisionUpgradeAllowedByThisLayer, false);
});

test("Recommendation intelligence UI surfaces remain paper-only and use one recommendation feed", async () => {
  const center = await readFile(new URL("../app/components/RecommendationIntelligenceCenter.jsx", import.meta.url), "utf8");
  const compare = await readFile(new URL("../app/recommendations/CompareRecommendationsClient.jsx", import.meta.url), "utf8");
  const brief = await readFile(new URL("../app/brief/RecommendationDailyBriefV2.jsx", import.meta.url), "utf8");
  for (const source of [center, compare, brief]) {
    assert.match(source, /\/api\/recommendations\?limit=/);
    assert.doesNotMatch(source, /placeBet|suggestedStake|realMoneyActionAvailable\s*=\s*true/i);
  }
  assert.match(center, /final safety/i);
  assert.match(compare, /CAUTION remains CAUTION/i);
  assert.match(brief, /paper-only/);
});
