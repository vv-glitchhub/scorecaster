import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  binaryBrierScore,
  binaryLogLoss,
  buildCalibrationReport,
  multiclassBrierScore,
  multiclassLogLoss,
  priceClv,
  probabilityClv,
  sampleStatus,
  wilsonInterval
} from "../lib/calibration-lab-v1.mjs";
import { calculateCLVV2, summarizeCLVHistory } from "../lib/clv-engine.js";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

function observation(overrides = {}) {
  return {
    id: "obs-1",
    bet_id: "bet-1",
    event_id: "event-1",
    sport: "soccer_epl",
    league: "Premier League",
    market: "h2h",
    selection: "Arsenal",
    bookmaker: "alpha",
    decision: "PLAY",
    model_version: "model-v1",
    entry_odds: 2.1,
    entry_market_probability: 0.48,
    model_probability: 0.55,
    closing_consensus_probability: 0.52,
    closing_fair_odds: 1 / 0.52,
    closing_provider_count: 4,
    closing_captured_at: "2026-08-05T17:55:00.000Z",
    commence_time: "2026-08-05T18:00:00.000Z",
    bet_created_at: "2026-08-05T12:00:00.000Z",
    settled_at: "2026-08-05T20:00:00.000Z",
    status: "won",
    outcome_value: 1,
    stake: 10,
    profit: 11,
    exclusion_reason: null,
    ...overrides
  };
}

test("CLV formulas use real no-vig closing probability", () => {
  const price = priceClv(2.1, 0.52);
  const probability = probabilityClv(0.48, 0.52);
  assert.ok(Math.abs(price.value - 0.092) < 0.000001);
  assert.ok(Math.abs(price.closingFairOdds - 1.9231) < 0.0001);
  assert.equal(price.positive, true);
  assert.ok(Math.abs(probability.value - 0.04) < 0.000001);
  assert.equal(probability.positive, true);
});

test("binary and multiclass Brier and log loss are exact and bounded", () => {
  assert.equal(binaryBrierScore(0.7, 1), 0.09);
  assert.ok(Math.abs(binaryLogLoss(0.7, 1) - 0.356675) < 0.000001);
  assert.equal(multiclassBrierScore([0.6, 0.25, 0.15], 0), 0.245);
  assert.ok(Math.abs(multiclassLogLoss([0.6, 0.25, 0.15], 0) - 0.510826) < 0.000001);
  assert.ok(Number.isFinite(binaryLogLoss(1, 0)));
  assert.ok(Number.isFinite(multiclassLogLoss([1, 0], 1)));
});

test("Wilson interval and calibration bins expose denominators", () => {
  const interval = wilsonInterval(6, 10);
  assert.ok(interval.lower < 0.6 && interval.upper > 0.6);
  const report = buildCalibrationReport([
    observation({ model_probability: 0.55, outcome_value: 1 }),
    observation({ id: "obs-2", bet_id: "bet-2", model_probability: 0.58, outcome_value: 0 })
  ]);
  const populated = report.calibrationBins.find((bin) => bin.count === 2);
  assert.ok(populated);
  assert.equal(populated.count, 2);
  assert.equal(populated.observed, 0.5);
  assert.ok(populated.observedInterval);
});

test("small samples are visibly insufficient and never promote a model", () => {
  assert.equal(sampleStatus(10).level, "insufficient");
  assert.equal(sampleStatus(50).level, "provisional");
  assert.equal(sampleStatus(100).level, "usable");
  const report = buildCalibrationReport(Array.from({ length: 100 }, (_, index) => observation({
    id: `obs-${index}`,
    bet_id: `bet-${index}`,
    outcome_value: index % 2,
    profit: index % 2 ? 11 : -10
  })));
  assert.equal(report.overall.sampleStatus.level, "usable");
  assert.equal(report.overall.promotionAllowed, false);
  assert.equal(report.championChallenger.automaticPromotion, false);
  assert.equal(report.safety.automaticModelPromotion, false);
});

test("excluded and incomplete records never contaminate trusted metrics", () => {
  const report = buildCalibrationReport([
    observation(),
    observation({ id: "excluded", bet_id: "excluded", exclusion_reason: "missing-eligible-closing-consensus", closing_consensus_probability: null, closing_fair_odds: null }),
    observation({ id: "incomplete", bet_id: "incomplete", model_probability: null })
  ]);
  assert.equal(report.received, 3);
  assert.equal(report.eligible, 1);
  assert.equal(report.excluded, 2);
  assert.equal(report.exclusions["missing-eligible-closing-consensus"], 1);
  assert.equal(report.exclusions["incomplete-metric-input"], 1);
  assert.ok(Math.abs(report.overall.averagePriceClv - 0.092) < 0.000001);
});

test("legacy CLV compatibility layer rejects current odds and unverified closing prices", () => {
  const noEvidence = calculateCLVV2({ betOdds: 2.1, currentOdds: 1.8, closingOdds: 1.9 });
  assert.equal(noEvidence.evidenceVerified, false);
  assert.equal(noEvidence.closingOdds, null);
  assert.equal(noEvidence.currentOddsFallbackUsed, false);
  assert.equal(noEvidence.simulatedClosingUsed, false);

  const summary = summarizeCLVHistory([{ betOdds: 2.1, currentOdds: 1.8 }, { betOdds: 2.1, closingOdds: 1.9 }]);
  assert.equal(summary.count, 0);
  assert.equal(summary.evidenceReady, false);
  assert.equal(summary.automaticModelPromotion, false);
});

test("storage patch is server-only, immutable and closing evidence is pre-start", async () => {
  const sql = await source("scripts/apply-calibration-lab-v1.sql");
  assert.match(sql, /create table if not exists public\.calibration_observations_v1/);
  assert.match(sql, /unique \(bet_id\)/i);
  assert.match(sql, /closing_captured_at is null or closing_captured_at < commence_time/i);
  assert.match(sql, /bet_created_at < commence_time/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /revoke all privileges .* public, anon, authenticated/i);
  assert.match(sql, /grant all privileges .* service_role/i);
  assert.doesNotMatch(sql, /grant\s+(select|insert|update|delete).*\b(anon|authenticated)\b/i);
  assert.doesNotMatch(sql, /drop\s+table|truncate\s+table|delete\s+from/i);
});

test("settlement worker ignores manual closing odds and uses Market Microstructure evidence only", async () => {
  const worker = await source("app/api/internal/calibration-settlement/route.js");
  assert.match(worker, /market_provider_snapshots_v2/);
  assert.match(worker, /buildMarketMicrostructure/);
  assert.match(worker, /final-prestart-consensus/);
  assert.match(worker, /manuallyEnteredClosingOddsUsed: false/);
  assert.match(worker, /currentOddsFallbackUsed: false/);
  assert.match(worker, /simulatedClosingUsed: false/);
  assert.doesNotMatch(worker, /bet\.closing_odds|bet\.closingOdds|estimateClosingOdds/);
});

test("legacy simulated endpoint is retired and cannot estimate a close", async () => {
  const route = await source("app/api/clv-tracker/route.js");
  assert.match(route, /status: 410/);
  assert.match(route, /simulated closing-line tracker has been removed/i);
  assert.match(route, /replacement: "\/api\/calibration"/);
  assert.doesNotMatch(route, /estimateClosingOdds|improvement|simulatedClosingOdds/);
});

test("authenticated API and CSV export strip personal and provider-sensitive identifiers", async () => {
  const api = await source("app/api/calibration/route.js");
  assert.match(api, /getAuthenticatedContext/);
  assert.match(api, /\.eq\("user_id", auth\.user\.id\)/);
  assert.match(api, /format === "csv"/);
  assert.match(api, /personalIdentifiersIncluded: false/);
  assert.doesNotMatch(api, /user_id.*csvCell|raw_provider|provider_payload|SUPABASE_SERVICE_ROLE_KEY/);
});

test("paper decision audit stores server model evidence and forbids closing fallbacks", async () => {
  const audited = await source("app/api/cloud/bets/audited/route.js");
  assert.match(audited, /auditVersion: "scorecaster-paper-decision-audit-v1"/);
  assert.match(audited, /entryMarketProbability/);
  assert.match(audited, /modelProbability/);
  assert.match(audited, /modelVersion/);
  assert.match(audited, /manuallyEnteredClosingAcceptedForCalibration: false/);
  assert.match(audited, /currentOddsFallbackAcceptedForCalibration: false/);
  assert.match(audited, /simulatedClosingAcceptedForCalibration: false/);
});

test("feedback loop cannot use CLV for automatic weights", async () => {
  const feedback = await source("lib/feedback-learning-loop.js");
  assert.match(feedback, /clvSummary: null/);
  assert.match(feedback, /clvUsedForAutomaticWeights: false/);
  assert.match(feedback, /automaticModelPromotion: false/);
  assert.doesNotMatch(feedback, /reward_positive_clv_profiles/);
});

test("Calibration Lab UI, docs and worker preserve paper-only human-review boundary", async () => {
  const [ui, docs, workflow] = await Promise.all([
    source("app/calibration/CalibrationLabClient.jsx"),
    source("docs/CALIBRATION_LAB_V1.md"),
    source(".github/workflows/calibration-settlement.yml")
  ]);
  assert.match(ui, /automaticPromotion=false/);
  assert.match(ui, /Simulated closing lines are never used/i);
  assert.match(docs, /never substitutes current odds/i);
  assert.match(docs, /no CLV-driven automatic weight change/i);
  assert.match(workflow, /api\/internal\/calibration-settlement/);
  for (const text of [ui, docs]) assert.doesNotMatch(text, /CRON_SECRET=|ODDS_API_KEY|SUPABASE_SERVICE_ROLE_KEY/);
});