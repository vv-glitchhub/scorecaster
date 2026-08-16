import test from "node:test";
import assert from "node:assert/strict";
import { buildUnifiedSportsDataLedger } from "../lib/unified-sports-data-v1.mjs";
import {
  buildVerifiedMarketHistory,
  UNIFIED_CAPTURE_MARKET_HISTORY_POLICY
} from "../lib/unified-capture-market-history-v1.mjs";
import { mergeMarketHistoryIntoCaptureLedger } from "../lib/unified-capture-ledger-merge-v1.mjs";
import { enrichPickForUnifiedCapture } from "../lib/unified-capture-enrichment-v1.mjs";

const NOW = Date.parse("2026-08-15T04:30:00Z");
const KICKOFF = "2026-08-16T18:00:00Z";

function pick(overrides = {}) {
  return {
    id: "evt-market",
    gameId: "evt-market",
    sportKey: "soccer_sweden_allsvenskan",
    league: "Allsvenskan",
    homeTeam: "Home FC",
    awayTeam: "Away FC",
    selection: "Away FC",
    commenceTime: KICKOFF,
    odds: 2.1,
    bookmakerCount: 18,
    confidence: 0.94,
    modelProbability: 0.48,
    consensusProbability: 0.48,
    edge: 0.028,
    ev: 0.04,
    decision: "WATCH",
    productDecision: "CAUTION",
    paperStake: 8,
    ...overrides
  };
}

function rows() {
  return [
    { captured_at: "2026-08-10T08:00:00Z", odds: 2.28 },
    { captured_at: "2026-08-11T08:00:00Z", odds: 2.24 },
    { captured_at: "2026-08-12T08:00:00Z", odds: 2.2 },
    { captured_at: "2026-08-14T08:00:00Z", odds: 2.15 },
    { captured_at: "2026-08-17T08:00:00Z", odds: 1.01 }
  ];
}

test("verified market history requires 3+ chronology-safe snapshots and a 30-minute span", () => {
  const history = buildVerifiedMarketHistory({ pick: pick(), rows: rows(), now: NOW });
  assert.equal(history.mode, "live");
  assert.equal(history.snapshotCount, 4);
  assert.equal(history.openingOdds, 2.28);
  assert.equal(history.currentOdds, 2.1);
  assert.ok(history.spanMinutes > 30);
  assert.equal(history.chronologySafe, true);
  assert.equal(history.externalProviderRequestMade, false);
  assert.equal(history.paperOnly, true);
  assert.equal(history.movementPct, Number((((2.1 - 2.28) / 2.28) * 100).toFixed(4)));
});

test("thin or same-minute history remains fail-closed", () => {
  const thin = buildVerifiedMarketHistory({ pick: pick(), rows: rows().slice(0, 2), now: NOW });
  assert.equal(thin.mode, "insufficient_history");

  const short = buildVerifiedMarketHistory({
    pick: pick(),
    now: NOW,
    rows: [
      { captured_at: "2026-08-15T04:00:00Z", odds: 2.2 },
      { captured_at: "2026-08-15T04:10:00Z", odds: 2.18 },
      { captured_at: "2026-08-15T04:20:00Z", odds: 2.15 }
    ]
  });
  assert.equal(short.mode, "insufficient_span");
});

test("post-kickoff or non-pregame fixtures never become verified movement", () => {
  const finished = buildVerifiedMarketHistory({
    pick: pick({ commenceTime: "2026-08-14T18:00:00Z" }),
    rows: rows(),
    now: NOW
  });
  assert.equal(finished.mode, "not_applicable");

  const pregame = buildVerifiedMarketHistory({ pick: pick(), rows: rows(), now: NOW });
  assert.equal(pregame.snapshotCount, 4);
  assert.notEqual(pregame.openingOdds, 1.01);
});

test("market history merge verifies only market movement and preserves decision semantics", () => {
  const sourcePick = pick();
  const base = buildUnifiedSportsDataLedger({ pick: sourcePick, sportsReport: {}, now: NOW });
  const beforeMovement = base.factors.find((factor) => factor.key === "market-movement");
  assert.equal(beforeMovement.status, "insufficient-history");
  const beforeVerified = base.coverage.verifiedPregameFamilies;
  const history = buildVerifiedMarketHistory({ pick: sourcePick, rows: rows(), now: NOW });
  const merged = mergeMarketHistoryIntoCaptureLedger({ pick: sourcePick, baseLedger: base, marketHistory: history, now: NOW });

  assert.equal(merged.merged, true);
  assert.equal(merged.reason, "verified-first-party-market-history");
  const movement = merged.ledger.factors.find((factor) => factor.key === "market-movement");
  assert.equal(movement.status, "ready");
  assert.equal(movement.usedByAi, true);
  assert.equal(movement.impact, 0);
  assert.equal(movement.sources[0].provider, "scorecaster-market-history");
  assert.equal(movement.evidence.find((item) => item.label === "snapshotCount")?.value, 4);
  assert.equal(merged.ledger.coverage.verifiedPregameFamilies, beforeVerified + 1);
  assert.equal(merged.ledger.totalBoundedContextImpact, base.totalBoundedContextImpact);
  assert.deepEqual(merged.ledger.safetyRecommendation, base.safetyRecommendation);
  assert.deepEqual(merged.ledger.aiExplanation, base.aiExplanation);
  assert.equal(merged.ledger.captureEvidence.probabilityChanged, false);
  assert.equal(merged.ledger.captureEvidence.decisionChanged, false);
  assert.equal(merged.ledger.captureEvidence.stakeChanged, false);
  assert.equal(merged.ledger.captureEvidence.contextImpactChanged, false);
});

test("capture enrichment can add market history without changing pick probability, edge, decision or stake", async () => {
  const sourcePick = pick();
  sourcePick.unifiedSportsData = buildUnifiedSportsDataLedger({ pick: sourcePick, sportsReport: {}, now: NOW });
  sourcePick.unifiedDataProviders = { primaryOdds: { source: "the-odds-api", mode: "live" } };
  const history = buildVerifiedMarketHistory({ pick: sourcePick, rows: rows(), now: NOW });
  const enriched = await enrichPickForUnifiedCapture(sourcePick, {
    now: NOW,
    fetchSecondary: async () => ({ ok: false, source: "sportsgameodds", mode: "unsupported_league", eventRequestMade: false }),
    fetchMarketHistory: async () => history
  });

  assert.equal(enriched.unifiedCaptureMarketHistoryMerged, true);
  assert.equal(enriched.unifiedDataProviders.marketHistory.mode, "live");
  assert.equal(enriched.unifiedDataProviders.marketHistory.externalProviderRequestMade, false);
  assert.equal(enriched.modelProbability, sourcePick.modelProbability);
  assert.equal(enriched.consensusProbability, sourcePick.consensusProbability);
  assert.equal(enriched.edge, sourcePick.edge);
  assert.equal(enriched.ev, sourcePick.ev);
  assert.equal(enriched.decision, sourcePick.decision);
  assert.equal(enriched.productDecision, sourcePick.productDecision);
  assert.equal(enriched.paperStake, sourcePick.paperStake);
});

test("market history policy is bounded, first-party and paper-only", () => {
  assert.equal(UNIFIED_CAPTURE_MARKET_HISTORY_POLICY.minimumSnapshots, 3);
  assert.equal(UNIFIED_CAPTURE_MARKET_HISTORY_POLICY.minimumSpanMinutes, 30);
  assert.equal(UNIFIED_CAPTURE_MARKET_HISTORY_POLICY.externalProviderRequestMade, false);
  assert.equal(UNIFIED_CAPTURE_MARKET_HISTORY_POLICY.probabilityChanged, false);
  assert.equal(UNIFIED_CAPTURE_MARKET_HISTORY_POLICY.decisionChanged, false);
  assert.equal(UNIFIED_CAPTURE_MARKET_HISTORY_POLICY.stakeChanged, false);
  assert.equal(UNIFIED_CAPTURE_MARKET_HISTORY_POLICY.paperOnly, true);
});
