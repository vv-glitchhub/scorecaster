import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildDecisionTransparency,
  OPEN_METHODOLOGY,
  PUBLIC_FORMULAS,
  publicRecord
} from "../lib/decision-transparency.mjs";
import { rankDailyTop3 } from "../lib/production-control-center.mjs";

const root = new URL("../", import.meta.url);
const file = (path) => readFile(new URL(path, root), "utf8");
const now = Date.parse("2026-07-31T06:00:00.000Z");

const records = [
  { eventId: "evt-open-1", sourceId: "scorecaster_internal", metric: "market_probability", value: 0.5, observedAt: "2026-07-31T05:30:00.000Z", collectedAt: "2026-07-31T05:31:00.000Z", confidence: 0.9, sourceTrust: 0.9, payload: { secret: "never-public" } },
  { eventId: "evt-open-1", sourceId: "manual_licensed_import", metric: "model_probability", value: 0.58, observedAt: "2026-07-31T05:35:00.000Z", collectedAt: "2026-07-31T05:36:00.000Z", confidence: 0.88, sourceTrust: 0.86, payload: { providerRaw: true } },
  { eventId: "evt-open-1", sourceId: "scorecaster_internal", metric: "best_odds", value: 2.1, observedAt: "2026-07-31T05:40:00.000Z", collectedAt: "2026-07-31T05:41:00.000Z", confidence: 0.9, sourceTrust: 0.9 }
];

test("public methodology contains the full primary formula catalogue", () => {
  const ids = new Set(PUBLIC_FORMULAS.map((formula) => formula.id));
  for (const id of ["implied-probability", "model-edge", "fair-odds", "expected-value", "freshness", "data-quality", "ranking-score", "kelly", "brier-score", "log-loss", "price-clv"]) {
    assert.ok(ids.has(id), `missing formula ${id}`);
  }
  assert.equal(OPEN_METHODOLOGY.dataPolicy.neverPublic.includes("API keys"), true);
  assert.match(OPEN_METHODOLOGY.decisionGates.WATCH, /edge ≥ 0\.04/);
});

test("decision explanation reproduces edge, EV and quality components", () => {
  const explanation = buildDecisionTransparency(records, { eventId: "evt-open-1", decision: "WATCH" }, now);
  assert.equal(explanation.eventId, "evt-open-1");
  assert.equal(explanation.calculations.marketProbability, 0.5);
  assert.equal(explanation.calculations.modelProbability, 0.58);
  assert.equal(explanation.calculations.edge, 0.08);
  assert.equal(explanation.calculations.expectedValuePerUnit, 0.218);
  assert.ok(explanation.calculations.quality > 0.6);
  assert.equal(explanation.sources.length, 2);
  assert.equal(explanation.disclosure.formulasPublic, true);
  assert.equal(explanation.disclosure.rawLicensedPayloadsPublic, false);
});

test("public normalized records never expose provider payloads", () => {
  const safe = publicRecord(records[0]);
  assert.equal(safe.metric, "market_probability");
  assert.equal(Object.hasOwn(safe, "payload"), false);
  assert.equal(JSON.stringify(safe).includes("never-public"), false);
});

test("Daily Top 3 remains populated with an honest market-only CAUTION or SKIP card", () => {
  const marketOnly = [
    { eventId: "market-only", sourceId: "scorecaster_internal", metric: "best_odds", value: 1.9, observedAt: "2026-07-31T05:50:00.000Z", confidence: 0.8, sourceTrust: 0.85 }
  ];
  const picks = rankDailyTop3(marketOnly, now);
  assert.equal(picks.length, 1);
  assert.equal(picks[0].eventId, "market-only");
  assert.ok(["CAUTION", "SKIP"].includes(picks[0].decision));
  assert.equal(picks[0].modelProbability, null);
  assert.ok(picks[0].missing.includes("model_probability"));
  assert.ok(picks[0].explanation.missingInputs.includes("independent model probability"));
});

test("public transparency API is unauthenticated, publishable-only and CORS-readable", async () => {
  const route = await file("app/api/transparency/route.js");
  assert.match(route, /Access-Control-Allow-Origin/);
  assert.match(route, /"\*"/);
  assert.match(route, /\.eq\("publishable", true\)/);
  assert.match(route, /OPEN_METHODOLOGY/);
  assert.match(route, /publicRecord/);
  assert.doesNotMatch(route, /select\([^\n]*payload/);
});

test("Scorecaster keeps the homepage action-first while deep transparency remains reachable", async () => {
  const [route, today, feed, card, page, shell] = await Promise.all([
    file("app/api/scorecaster-app/route.js"),
    file("app/components/TodayPageV3.jsx"),
    file("app/feed/FeedClient.jsx"),
    file("app/components/DecisionTransparencyCard.jsx"),
    file("app/transparency/TransparencyClient.jsx"),
    file("app/components/AppShell.jsx")
  ]);
  assert.match(route, /methodology: OPEN_METHODOLOGY/);
  assert.match(route, /records: records\.map\(publicRecord\)/);
  assert.match(route, /rawLicensedPayloadsPublic: false/);

  // Today remains an action-first surface while preserving real market/model inputs,
  // honest missing-evidence states and direct access to deeper transparency surfaces.
  assert.match(today, /data-homepage-v3="mobile-first"/);
  assert.match(today, /REAL DATA · PAPER ONLY/);
  assert.match(today, /Dataa\. /);
  assert.match(today, /Parempia päätöksiä/);
  assert.match(today, /Top AI Picks/);
  assert.match(today, /Match Hub/);
  assert.match(today, /Ei PLAY-kohteita juuri nyt/);
  assert.match(today, /\/api\/recommendations\?limit=20/);
  assert.match(today, /independentModelProbability/);
  assert.match(today, /marketProbability/);
  assert.match(today, /href="\/feed"/);
  assert.match(today, /href="\/model-lab#validation-lab"/);
  assert.match(today, /PAPER ONLY/);
  assert.match(today, /Ei vedonvälittäjä\. Ei lähetä vetoa eikä siirrä rahaa\./);
  assert.doesNotMatch(today, /\bPlace Bet\b|potential return|Avg\. ROI|92% Confidence/i);

  assert.match(feed, /DecisionTransparencyCard/);
  assert.match(feed, /Kaikki kaavat ja lähteet/);
  assert.match(card, /Miksi AI päätyi tähän/);
  assert.match(page, /Open Scorecaster/);
  assert.match(page, /\/api\/transparency/);
  assert.match(shell, /href: "\/transparency"/);
});