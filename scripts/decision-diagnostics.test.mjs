import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  diagnosticReasonCodes,
  normalizeDiagnosticDecision,
  summarizeDecisionDiagnostics
} from "../lib/decision-diagnostics.mjs";

function pick(overrides = {}) {
  return {
    id: "pick-home",
    gameId: "event-123",
    sportKey: "baseball_mlb",
    leagueTitle: "MLB",
    match: "Home Team vs Away Team",
    homeTeam: "Home Team",
    awayTeam: "Away Team",
    selection: "Home Team",
    odds: 2.1,
    edge: 0.024,
    ev: 0.05,
    confidence: 0.64,
    bookmakerCount: 6,
    freshnessLabel: "fresh",
    dataAgeHours: 0.4,
    qualityGrade: "B",
    decision: "BET",
    productDecision: "PLAY",
    marketDecisionBeforeSafetyGate: "BET",
    dataGate: {
      bookmakerCount: 6,
      confidence: 0.64,
      freshness: "fresh",
      stale: false,
      playable: true,
      watchable: true
    },
    sportsIntelligence: {
      readiness: { level: "verified" },
      conflicts: []
    },
    ...overrides
  };
}

test("normalizes internal decisions into PLAY, CAUTION and SKIP", () => {
  assert.equal(normalizeDiagnosticDecision({ decision: "BET" }), "PLAY");
  assert.equal(normalizeDiagnosticDecision({ decision: "WATCH" }), "CAUTION");
  assert.equal(normalizeDiagnosticDecision({ decision: "WAIT" }), "CAUTION");
  assert.equal(normalizeDiagnosticDecision({ decision: "PASS" }), "SKIP");
});

test("explains stale all-SKIP output with structured gate reasons", () => {
  const stale = pick({
    id: "stale",
    productDecision: "SKIP",
    decision: "PASS",
    edge: 0.002,
    ev: -0.01,
    confidence: 0.25,
    bookmakerCount: 1,
    freshnessLabel: "stale",
    dataAgeHours: 14,
    dataGate: {
      bookmakerCount: 1,
      confidence: 0.25,
      freshness: "stale",
      stale: true,
      playable: false,
      watchable: false
    }
  });

  assert.deepEqual(diagnosticReasonCodes(stale), [
    "stale-odds",
    "insufficient-bookmakers",
    "low-market-confidence",
    "edge-below-watch-floor",
    "non-positive-ev"
  ]);

  const diagnostics = summarizeDecisionDiagnostics({ data: [stale], generatedAt: "2026-07-22T10:00:00Z" });
  assert.equal(diagnostics.status, "blocked");
  assert.equal(diagnostics.allSkip, true);
  assert.equal(diagnostics.counts.SKIP, 1);
  assert.equal(diagnostics.reasons[0].count, 1);
  assert.equal(diagnostics.dataQuality.staleRate, 1);
});

test("ranks usable CAUTION selections nearest to PLAY without upgrading them", () => {
  const close = pick({
    id: "close",
    productDecision: "CAUTION",
    decision: "WATCH",
    marketDecisionBeforeSafetyGate: "WATCH",
    edge: 0.019,
    ev: 0.028,
    confidence: 0.58,
    bookmakerCount: 5,
    dataGate: { bookmakerCount: 5, confidence: 0.58, freshness: "fresh", stale: false, playable: true, watchable: true }
  });
  const far = pick({
    id: "far",
    productDecision: "CAUTION",
    decision: "WAIT",
    marketDecisionBeforeSafetyGate: "WAIT",
    edge: 0.011,
    ev: 0.016,
    confidence: 0.4,
    bookmakerCount: 2,
    dataGate: { bookmakerCount: 2, confidence: 0.4, freshness: "recent", stale: false, playable: false, watchable: true }
  });

  const diagnostics = summarizeDecisionDiagnostics({ data: [far, close] });
  assert.equal(diagnostics.counts.CAUTION, 2);
  assert.equal(diagnostics.counts.PLAY, 0);
  assert.equal(diagnostics.nearPlay[0].id, "close");
  assert.equal(diagnostics.nearPlay[0].diagnosticDecision, "CAUTION");
  assert.ok(diagnostics.nearPlay[0].diagnosticReasonCodes.includes("play-edge"));
  assert.ok(diagnostics.nearPlay[0].diagnosticReasonCodes.includes("play-ev"));
});

test("separates evidence downgrades from weak market-data gates", () => {
  const downgraded = pick({
    id: "downgraded",
    productDecision: "CAUTION",
    decision: "WATCH",
    marketDecisionBeforeSafetyGate: "BET",
    sportsIntelligence: { readiness: { level: "partial" }, conflicts: [] }
  });
  const diagnostics = summarizeDecisionDiagnostics({ data: [downgraded] });

  assert.equal(diagnostics.safetyDowngrades.length, 1);
  assert.equal(diagnostics.safetyDowngrades[0].id, "downgraded");
  assert.ok(diagnostics.safetyDowngrades[0].diagnosticReasonCodes.includes("intelligence-safety-downgrade"));
  assert.ok(diagnostics.safetyDowngrades[0].diagnosticReasonCodes.includes("intelligence-not-verified"));
});

test("creates league-level coverage without changing source picks", () => {
  const source = [
    pick(),
    pick({ id: "wnba", gameId: "event-wnba", leagueTitle: "WNBA", sportKey: "basketball_wnba", productDecision: "CAUTION", decision: "WATCH", edge: 0.015, ev: 0.02 })
  ];
  const before = JSON.stringify(source);
  const diagnostics = summarizeDecisionDiagnostics({ data: source, leagueSelectionMode: "season-aware-default" });

  assert.equal(diagnostics.leagues.length, 2);
  assert.equal(diagnostics.leagues.find((item) => item.league === "MLB")?.PLAY, 1);
  assert.equal(diagnostics.leagues.find((item) => item.league === "WNBA")?.CAUTION, 1);
  assert.equal(diagnostics.leagueSelectionMode, "season-aware-default");
  assert.equal(JSON.stringify(source), before);
});

test("Decision Diagnostics page is reachable and preserves product boundaries", async () => {
  const client = await readFile(new URL("../app/diagnostics/DiagnosticsClient.jsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/diagnostics/page.jsx", import.meta.url), "utf8");
  const shell = await readFile(new URL("../app/components/AppShell.jsx", import.meta.url), "utf8");

  assert.match(page, /DiagnosticsClient/);
  assert.match(client, /\/api\/top-picks/);
  assert.match(client, /Decision Diagnostics V1/);
  assert.match(client, /Lähimpänä PLAY-päätöstä/);
  assert.match(client, /Markkina läpäisi PLAY-rajan/);
  assert.match(client, /ei takaa tuloksia/);
  assert.doesNotMatch(client, /bookmaker.*redirect/i);
  assert.match(shell, /\/diagnostics/);
});
