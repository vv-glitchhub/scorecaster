import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildAiCoachReport, AI_COACH_VERSION } from "../lib/ai-coach-v1.mjs";

const baseTime = Date.parse("2026-08-01T12:00:00.000Z");

function observation(index, overrides = {}) {
  const kickoff = new Date(baseTime + index * 86400000).toISOString();
  const late = index < 6;
  const created = new Date(Date.parse(kickoff) - (late ? 15 : 180) * 60000).toISOString();
  const lost = index % 3 === 0;
  return {
    id: `observation-${index}`,
    bet_id: `bet-${index}`,
    event_id: index < 2 ? "shared-event" : `event-${index}`,
    sport: index % 2 ? "soccer" : "icehockey",
    league: index % 2 ? "EPL" : "NHL",
    market: "h2h",
    selection: index % 2 ? "Home" : "Away",
    bookmaker: index % 2 ? "Book A" : "Book B",
    decision: index % 4 === 0 ? "WATCH" : "PLAY",
    model_version: "model-v1",
    entry_odds: 2,
    entry_market_probability: 0.5,
    model_probability: 0.54,
    closing_consensus_probability: late ? 0.48 : 0.52,
    closing_fair_odds: late ? 1 / 0.48 : 1 / 0.52,
    closing_provider_count: 4,
    closing_captured_at: new Date(Date.parse(kickoff) - 60000).toISOString(),
    commence_time: kickoff,
    bet_created_at: created,
    settled_at: new Date(Date.parse(kickoff) + 3 * 3600000).toISOString(),
    status: lost ? "lost" : "won",
    outcome_value: lost ? 0 : 1,
    stake: 10,
    profit: lost ? -10 : 10,
    price_clv: late ? -0.04 : 0.04,
    probability_clv: late ? -0.02 : 0.02,
    brier_score: lost ? 0.2916 : 0.2116,
    log_loss: lost ? 0.7765 : 0.6162,
    exclusion_reason: null,
    ...overrides
  };
}

const observations = Array.from({ length: 25 }, (_, index) => observation(index));
const priceChoices = observations.slice(0, 8).map((row, index) => ({
  observationId: row.id,
  entryOdds: 2,
  bestAvailableOdds: index < 5 ? 2.08 : 2,
  providerCount: 4
}));
const decisionAudits = Array.from({ length: 12 }, (_, index) => ({
  id: `audit-${index}`,
  allowed: false,
  reasons: index < 9 ? ["provider coverage below safety threshold"] : ["operator review"]
}));

function report() {
  return buildAiCoachReport({
    generatedAt: "2026-08-06T00:00:00.000Z",
    windowDays: 365,
    minimumSample: 20,
    observations,
    priceChoices,
    decisionAudits
  });
}

test("AI Coach is deterministic, paper-only and cannot change models or stakes", () => {
  const first = report();
  const second = report();
  assert.deepEqual(first, second);
  assert.equal(first.version, AI_COACH_VERSION);
  assert.equal(first.boundaries.paperOnly, true);
  assert.equal(first.boundaries.modelProbabilityChanged, false);
  assert.equal(first.boundaries.automaticDecisionChanged, false);
  assert.equal(first.boundaries.automaticStakeChanged, false);
  assert.equal(first.boundaries.realMoneyExecution, false);
  assert.equal(first.boundaries.lossChasingAdvice, false);
  assert.equal(first.boundaries.profitGuarantee, false);
  assert.equal(first.audit.generatedNarrativeUsedAsEvidence, false);
  assert.equal(first.insights.every((item) => item.canChangeModel === false && item.canChangeStakeAutomatically === false), true);
});

test("every coaching statement exposes evidence and a denominator", () => {
  const result = report();
  assert.ok(result.insights.length >= 5);
  for (const item of result.insights) {
    assert.ok(item.id);
    assert.ok(item.title);
    assert.ok(item.message);
    assert.ok(item.action);
    assert.notEqual(item.denominator, null);
    assert.ok(Number(item.denominator) >= 0);
    assert.ok(item.evidence && typeof item.evidence === "object");
  }
});

test("low samples are labelled insufficient or provisional instead of facts", () => {
  const result = buildAiCoachReport({
    generatedAt: "2026-08-06T00:00:00.000Z",
    minimumSample: 20,
    observations: observations.slice(0, 6)
  });
  assert.notEqual(result.overview.sampleState, "usable");
  assert.equal(result.boundaries.lowSampleFindingsAreFacts, false);
  assert.equal(result.insights.every((item) => item.confidence !== "usable"), true);
});

test("late entry, provider choice, correlation, good losses and disciplined skips are evidence-based", () => {
  const result = report();
  const ids = new Set(result.insights.map((item) => item.id));
  assert.equal(ids.has("late-entry-cost"), true);
  assert.equal(ids.has("provider-price-choice"), true);
  assert.equal(ids.has("correlated-event-exposure"), true);
  assert.equal(ids.has("good-process-losses"), true);
  assert.equal(ids.has("disciplined-skips"), true);
  const goodLoss = result.insights.find((item) => item.id === "good-process-losses");
  assert.ok(goodLoss.numerator > 0);
  assert.ok(goodLoss.supportingIds.length > 0);
});

test("excluded observations never enter trusted performance metrics", () => {
  const excluded = observation(30, {
    id: "excluded-row",
    exclusion_reason: "missing-eligible-closing-consensus",
    price_clv: 50,
    profit: 100000
  });
  const result = buildAiCoachReport({
    generatedAt: "2026-08-06T00:00:00.000Z",
    minimumSample: 20,
    observations: [...observations, excluded]
  });
  assert.equal(result.overview.eligible, observations.length);
  assert.equal(result.overview.excluded, 1);
  assert.equal(result.evidence.exclusions["missing-eligible-closing-consensus"], 1);
  assert.ok(result.overview.totalProfit < 100000);
});

test("coach output contains no harmful staking or guarantee instruction", () => {
  const serialized = JSON.stringify(report()).toLowerCase();
  for (const phrase of [
    "chase losses",
    "recover your losses",
    "double your stake",
    "increase your stake after",
    "deposit money",
    "guaranteed profit",
    "guaranteed win"
  ]) {
    assert.equal(serialized.includes(phrase), false, `Forbidden phrase found: ${phrase}`);
  }
});

test("AI Coach SQL enforces own-user RLS, read-only reports and paper-only constraints", async () => {
  const sql = await readFile(new URL("./apply-ai-coach-v1.sql", import.meta.url), "utf8");
  const verify = await readFile(new URL("./verify-ai-coach-v1.sql", import.meta.url), "utf8");
  const proof = await readFile(new URL("./prove-ai-coach-two-user-isolation.mjs", import.meta.url), "utf8");

  assert.match(sql, /ai_coach_preferences_v1[\s\S]*references auth\.users\(id\) on delete cascade/i);
  assert.match(sql, /ai_coach_reports_v1[\s\S]*references auth\.users\(id\) on delete cascade/i);
  assert.match(sql, /alter table public\.ai_coach_preferences_v1 enable row level security/i);
  assert.match(sql, /alter table public\.ai_coach_preferences_v1 force row level security/i);
  assert.match(sql, /alter table public\.ai_coach_reports_v1 enable row level security/i);
  assert.match(sql, /alter table public\.ai_coach_reports_v1 force row level security/i);
  assert.match(sql, /using \(auth\.uid\(\) = user_id\)/i);
  assert.match(sql, /with check \(auth\.uid\(\) = user_id and paper_only = true\)/i);
  assert.match(sql, /revoke all privileges on table public\.ai_coach_reports_v1 from public, anon, authenticated/i);
  assert.match(sql, /grant select on table public\.ai_coach_reports_v1 to authenticated/i);
  assert.doesNotMatch(sql, /grant\s+(insert|update|delete)[^;]*ai_coach_reports_v1[^;]*authenticated/i);
  assert.match(verify, /reportsReadOnlyForUser/i);
  assert.match(proof, /AI_COACH_USER_A_TOKEN/);
  assert.match(proof, /AI_COACH_USER_B_TOKEN/);
  assert.match(proof, /crossUpdatesBlocked/);
  assert.match(proof, /reportClientWritesBlocked/);
  assert.doesNotMatch(sql, /\b(drop table|truncate table|delete from)\b/i);
});

test("authenticated API, Profile, export and deletion preserve user privacy controls", async () => {
  const api = await readFile(new URL("../app/api/ai-coach/route.js", import.meta.url), "utf8");
  const health = await readFile(new URL("../app/api/ai-coach/health/route.js", import.meta.url), "utf8");
  const profile = await readFile(new URL("../app/profile/page.jsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/coach/AiCoachClient.jsx", import.meta.url), "utf8");
  const navigation = await readFile(new URL("../app/components/AppShell.jsx", import.meta.url), "utf8");
  const accountExport = await readFile(new URL("../app/api/account/export/route.js", import.meta.url), "utf8");
  const accountDelete = await readFile(new URL("../app/api/account/route.js", import.meta.url), "utf8");
  const docs = await readFile(new URL("../docs/AI_COACH_V1.md", import.meta.url), "utf8");

  assert.match(api, /getAuthenticatedContext/);
  assert.match(api, /\.eq\("user_id", auth\.user\.id\)/);
  assert.match(api, /mutationOriginAllowed/);
  assert.match(api, /max_notifications_per_week/);
  assert.match(api, /minimum_sample/);
  assert.match(api, /automaticStakeChanged: false/);
  assert.match(api, /rawProviderPayloadReturned: false/);
  assert.match(health, /userIdentifiersReturned: false/);
  assert.match(health, /reportPayloadReturned: false/);
  assert.match(profile, /href="\/coach"/);
  assert.match(page, /AI Coach V1/);
  assert.match(page, /automaticStakeChange=false/);
  assert.match(navigation, /href: "\/coach"/);
  assert.match(accountExport, /ai_coach_preferences_v1/);
  assert.match(accountExport, /ai_coach_reports_v1/);
  assert.match(accountExport, /aiCoachPreferences/);
  assert.match(accountExport, /aiCoachReports/);
  assert.match(accountDelete, /"ai_coach_reports_v1"[\s\S]*"ai_coach_preferences_v1"/);
  assert.match(docs, /Two-user RLS proof/i);
  assert.match(docs, /no model, decision or stake modification/i);
});
