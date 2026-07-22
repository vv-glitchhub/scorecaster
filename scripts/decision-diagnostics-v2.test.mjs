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
import {
  buildDiagnosticReport,
  diagnoseProviderRootCauses,
  diagnosticReportCsv,
  summarizeDiagnosticTrends
} from "../lib/decision-diagnostics-v21.mjs";

function pick(overrides = {}) {
  return {
    id: "pick-1", gameId: "game-1", match: "Home vs Away", selection: "Home",
    leagueTitle: "Test League", sportKey: "test_league", productDecision: "CAUTION",
    decision: "WATCH", marketDecisionBeforeSafetyGate: "WATCH", odds: 2.1,
    edge: 0.015, ev: 0.025, confidence: 0.6, bookmakerCount: 5,
    freshnessLabel: "fresh", qualityGrade: "B",
    sportsIntelligence: { readiness: { level: "verified" }, conflicts: [] },
    intelligenceRelativeImpact: 0, ...overrides
  };
}

function payload(data) {
  return {
    ok: true, source: "no-vig-market-consensus", fixtureSource: "live-odds-provider-only",
    generatedAt: "2026-07-22T10:00:00.000Z", leagueSelectionMode: "season-aware-default",
    defaultLeagueSeason: "summer", leagues: ["test_league"], providerGames: data.length,
    acceptedGames: data.length, excludedGames: 0, data
  };
}

test("Provider Health separates live coverage from decision quality", () => {
  const health = buildProviderHealth(payload([
    pick({ id: "play", productDecision: "PLAY", decision: "BET", edge: 0.03, ev: 0.05 }),
    pick({ id: "skip", productDecision: "SKIP", decision: "PASS", freshnessLabel: "stale", confidence: 0.2 })
  ]));
  assert.equal(health.providerGames, 2);
  assert.equal(health.acceptedGames, 2);
  assert.equal(health.coverageRate, 1);
  assert.ok(["healthy", "degraded"].includes(health.status));
  assert.equal(health.leagues.length, 1);
});

test("Threshold simulator is descriptive and preserves evidence downgrade safety", () => {
  const balanced = simulateDecisionThresholds([
    pick({ id: "candidate", edge: 0.018, ev: 0.028 }),
    pick({ id: "verified-play", productDecision: "PLAY", decision: "BET", marketDecisionBeforeSafetyGate: "BET", edge: 0.03, ev: 0.05 }),
    pick({ id: "unverified", edge: 0.03, ev: 0.05, marketDecisionBeforeSafetyGate: "BET", sportsIntelligence: { readiness: { level: "partial" }, conflicts: [] } })
  ], { minimumPlayEdge: 0.015, minimumPlayEv: 0.025 });
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
  const types = new Set(evaluateDiagnosticAlerts(snapshot, history).map((item) => item.alertType));
  assert.equal(types.has("all_skip"), true);
  assert.equal(types.has("stale_data"), true);
  assert.equal(types.has("provider_health"), true);
  assert.equal(types.has("no_play_streak"), true);
});

test("V2.1 trend engine detects worsening decision and provider flow", () => {
  const history = Array.from({ length: 12 }, (_, index) => {
    const worsening = index >= 6;
    return {
      capturedAt: `2026-07-22T${String(index).padStart(2, "0")}:00:00.000Z`,
      total: 10,
      counts: worsening ? { PLAY: 0, CAUTION: 2, SKIP: 8 } : { PLAY: 3, CAUTION: 5, SKIP: 2 },
      staleRate: worsening ? 0.7 : 0.1,
      averageBookmakers: worsening ? 2 : 5,
      providerHealth: { score: worsening ? 35 : 90, status: worsening ? "degraded" : "healthy" }
    };
  });
  const trends = summarizeDiagnosticTrends(history, { windowSize: 6 });
  assert.equal(trends.status, "worsening");
  assert.equal(trends.directions.skipRate, "worsening");
  assert.equal(trends.directions.providerScore, "worsening");
  assert.equal(trends.noPlayStreak, 6);
});

test("V2.1 provider diagnosis prioritizes actionable provider causes", () => {
  const diagnosis = diagnoseProviderRootCauses({
    status: "degraded", score: 32, reasons: ["stale-market-data", "weak-bookmaker-coverage"],
    coverageRate: 0.8, staleRate: 0.75, averageBookmakers: 1.8, averageConfidence: 0.3,
    leagues: [{ league: "Test League", status: "degraded", staleRate: 0.8, averageBookmakers: 1.5, total: 4 }]
  }, { status: "blocked" });
  assert.equal(diagnosis.classification, "provider-degradation");
  assert.equal(diagnosis.primaryCause.code, "stale-market-data");
  assert.match(diagnosis.recommendation, /timestamps|refresh/i);
  assert.equal(diagnosis.degradedLeagues[0].league, "Test League");
});

test("V2.1 report export produces bounded JSON and CSV structures", () => {
  const report = buildDiagnosticReport({ generatedAt: "2026-07-22T12:00:00.000Z", current: { total: 1, counts: { PLAY: 1, CAUTION: 0, SKIP: 0 } }, history: { items: [] }, paperOnly: true });
  const csv = diagnosticReportCsv(report);
  assert.equal(report.paperOnly, true);
  assert.match(report.version, /diagnostic-report/);
  assert.match(csv, /section,captured_at|"section","captured_at"/);
  assert.match(csv, /current/);
  assert.doesNotMatch(csv, /SUPABASE_SERVICE_ROLE_KEY|CRON_SECRET/);
});

test("Diagnostics V2.1 ships trends, report, alerts integration and native parity", async () => {
  const [schema, worker, api, report, web, enhancements, provider, alerts, mobile, more, workflow, readiness] = await Promise.all([
    readFile(new URL("../supabase/scorecaster_decision_diagnostics.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/api/internal/decision-diagnostics/route.js", import.meta.url), "utf8"),
    readFile(new URL("../app/api/diagnostics-v2/route.js", import.meta.url), "utf8"),
    readFile(new URL("../app/api/diagnostics-v2/report/route.js", import.meta.url), "utf8"),
    readFile(new URL("../app/diagnostics-v2/DiagnosticsV2Client.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/diagnostics-v2/DiagnosticsV21Enhancements.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/provider-health/page.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/alerts/DiagnosticIncidentPanel.jsx", import.meta.url), "utf8"),
    readFile(new URL("../mobile/src/screens/DiagnosticsScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../mobile/src/screens/MoreScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/decision-diagnostics.yml", import.meta.url), "utf8"),
    readFile(new URL("../config/release-readiness.json", import.meta.url), "utf8")
  ]);
  assert.match(schema, /decision_diagnostic_snapshots/);
  assert.match(worker, /evaluateDiagnosticAlerts/);
  assert.match(api, /summarizeDiagnosticTrends/);
  assert.match(report, /Content-Disposition/);
  assert.match(web, /id="threshold-simulator"/);
  assert.match(enhancements, /diagnostic-trends/);
  assert.match(enhancements, /provider-root-cause/);
  assert.match(provider, /DiagnosticsV21Enhancements/);
  assert.match(alerts, /System incidents/);
  assert.match(mobile, /providerDiagnosis/);
  assert.match(more, /DiagnosticsScreen/);
  assert.match(workflow, /cron: "12 \* \* \* \*"/);
  assert.match(readiness, /scorecaster_decision_diagnostics\.sql/);
});
