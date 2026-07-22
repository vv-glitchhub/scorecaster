import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  analyzeDecisionOutcomes,
  buildDiagnosticSnapshot,
  buildProviderHealth,
  evaluateDiagnosticAlerts,
  simulateDecisionThresholds
} from "../lib/decision-diagnostics-v2.mjs";

function pick(overrides = {}) {
  return {
    id: "pick-1",
    gameId: "game-1",
    match: "Home vs Away",
    selection: "Home",
    leagueTitle: "Test League",
    sportKey: "test_league",
    productDecision: "CAUTION",
    decision: "WATCH",
    marketDecisionBeforeSafetyGate: "WATCH",
    odds: 2.1,
    edge: 0.015,
    ev: 0.025,
    confidence: 0.6,
    bookmakerCount: 5,
    freshnessLabel: "fresh",
    qualityGrade: "B",
    sportsIntelligence: { readiness: { level: "verified" }, conflicts: [] },
    intelligenceRelativeImpact: 0,
    ...overrides
  };
}

function payload(data) {
  return {
    ok: true,
    source: "no-vig-market-consensus",
    fixtureSource: "live-odds-provider-only",
    generatedAt: "2026-07-22T10:00:00.000Z",
    leagueSelectionMode: "season-aware-default",
    defaultLeagueSeason: "summer",
    leagues: ["test_league"],
    providerGames: data.length,
    acceptedGames: data.length,
    excludedGames: 0,
    data
  };
}

test("Provider Health separates live coverage from decision quality", () => {
  const snapshotInput = payload([
    pick({ id: "play", productDecision: "PLAY", decision: "BET", edge: 0.03, ev: 0.05 }),
    pick({ id: "skip", productDecision: "SKIP", decision: "PASS", freshnessLabel: "stale", confidence: 0.2 })
  ]);
  const health = buildProviderHealth(snapshotInput);
  assert.equal(health.providerGames, 2);
  assert.equal(health.acceptedGames, 2);
  assert.equal(health.coverageRate, 1);
  assert.ok(["healthy", "degraded"].includes(health.status));
  assert.equal(health.leagues.length, 1);
});

test("Threshold simulator is descriptive and preserves evidence downgrade safety", () => {
  const picks = [
    pick({ id: "candidate", edge: 0.018, ev: 0.028 }),
    pick({ id: "verified-play", productDecision: "PLAY", decision: "BET", marketDecisionBeforeSafetyGate: "BET", edge: 0.03, ev: 0.05 }),
    pick({ id: "unverified", edge: 0.03, ev: 0.05, marketDecisionBeforeSafetyGate: "BET", sportsIntelligence: { readiness: { level: "partial" }, conflicts: [] } })
  ];
  const balanced = simulateDecisionThresholds(picks, { minimumPlayEdge: 0.015, minimumPlayEv: 0.025 });
  assert.equal(balanced.descriptiveOnly, true);
  assert.equal(balanced.counts.PLAY, 2);
  assert.equal(balanced.counts.CAUTION, 1);
  assert.equal(balanced.decisions.find((item) => item.id === "unverified")?.simulatedDecision, "CAUTION");
});

test("Decision outcome analysis groups settled paper results and CLV", () => {
  const analysis = analyzeDecisionOutcomes([
    { status: "won", stake: 10, profit: 11, clv: 2.5, edge: 0.03, raw_pick: { decision: "PLAY", decisionReasons: ["play-edge"] } },
    { status: "lost", stake: 10, profit: -10, clv: -1, edge: 0.025, raw_pick: { decision: "PLAY", decisionReasons: ["play-edge"] } },
    { status: "open", stake: 5, profit: null, clv: null, raw_pick: { decision: "PLAY" } }
  ]);
  assert.equal(analysis.settled, 2);
  assert.equal(analysis.totalProfit, 1);
  assert.equal(analysis.roi, 0.05);
  assert.equal(analysis.byDecision.find((item) => item.decision === "PLAY")?.settled, 2);
  assert.equal(analysis.byReason[0].reason, "play-edge");
});

test("Automatic alerts cover all-SKIP, stale data, provider health and no-PLAY streak", () => {
  const snapshot = buildDiagnosticSnapshot(payload([
    pick({ id: "skip-a", productDecision: "SKIP", decision: "PASS", freshnessLabel: "stale", confidence: 0.2, edge: 0.001, ev: -0.01 }),
    pick({ id: "skip-b", productDecision: "SKIP", decision: "PASS", freshnessLabel: "stale", confidence: 0.2, edge: 0.001, ev: -0.01 })
  ]));
  const history = Array.from({ length: 5 }, (_, index) => ({ total: 2, counts: { PLAY: 0, CAUTION: 1, SKIP: 1 }, capturedAt: `2026-07-22T0${index}:00:00.000Z` }));
  const alerts = evaluateDiagnosticAlerts(snapshot, history);
  const types = new Set(alerts.map((item) => item.alertType));
  assert.equal(types.has("all_skip"), true);
  assert.equal(types.has("stale_data"), true);
  assert.equal(types.has("provider_health"), true);
  assert.equal(types.has("no_play_streak"), true);
});

test("Diagnostics V2 ships storage, worker, web, provider and native surfaces", async () => {
  const [schema, worker, api, web, provider, mobile, more, workflow, readiness] = await Promise.all([
    readFile(new URL("../supabase/scorecaster_decision_diagnostics.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/api/internal/decision-diagnostics/route.js", import.meta.url), "utf8"),
    readFile(new URL("../app/api/diagnostics-v2/route.js", import.meta.url), "utf8"),
    readFile(new URL("../app/diagnostics-v2/DiagnosticsV2Client.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/provider-health/page.jsx", import.meta.url), "utf8"),
    readFile(new URL("../mobile/src/screens/DiagnosticsScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../mobile/src/screens/MoreScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/decision-diagnostics.yml", import.meta.url), "utf8"),
    readFile(new URL("../config/release-readiness.json", import.meta.url), "utf8")
  ]);
  assert.match(schema, /decision_diagnostic_snapshots/);
  assert.match(schema, /decision_diagnostic_alerts/);
  assert.match(worker, /evaluateDiagnosticAlerts/);
  assert.match(api, /analyzeDecisionOutcomes/);
  assert.match(web, /id="threshold-simulator"/);
  assert.match(provider, /focus="provider"/);
  assert.match(mobile, /Provider Health/);
  assert.match(more, /DiagnosticsScreen/);
  assert.match(workflow, /cron: "12 \* \* \* \*"/);
  assert.match(workflow, /Authorization: Bearer/);
  assert.match(readiness, /scorecaster_decision_diagnostics\.sql/);
});