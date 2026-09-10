import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildVisibleObservations, withVisibleDailyTop3 } from "../lib/visible-observations.mjs";

const root = new URL("../", import.meta.url);
const file = (path) => readFile(new URL(path, root), "utf8");
const now = Date.parse("2026-07-31T10:00:00.000Z");

const marketOnlyEvent = {
  eventId: "evt-market-only",
  latestAt: "2026-07-31T09:30:00.000Z",
  records: [
    { eventId: "evt-market-only", sourceId: "scorecaster_internal", metric: "best_odds", value: 2.1, observedAt: "2026-07-31T09:30:00.000Z", confidence: 0.8, sourceTrust: 0.9 },
    { eventId: "evt-market-only", sourceId: "scorecaster_internal", metric: "market_probability", value: 0.48, observedAt: "2026-07-31T09:30:00.000Z", confidence: 0.8, sourceTrust: 0.9 }
  ]
};

test("market-only evidence becomes an honest visible observation without inventing a model probability", () => {
  const observations = buildVisibleObservations([marketOnlyEvent], { now, limit: 3 });
  assert.equal(observations.length, 1);
  assert.equal(observations[0].eventId, "evt-market-only");
  assert.equal(observations[0].modelProbability, null);
  assert.equal(observations[0].observationType, "market-only");
  assert.ok(["CAUTION", "SKIP"].includes(observations[0].decision));
  assert.ok(observations[0].explanation.missingInputs.includes("independent model probability"));
});

test("visible Daily Top 3 only fills an empty strict result", () => {
  const observations = buildVisibleObservations([marketOnlyEvent], { now, limit: 3 });
  const filled = withVisibleDailyTop3({ dailyTop3: [], summary: {} }, observations);
  assert.equal(filled.dailyTop3.length, 1);
  assert.equal(filled.fallbackActive, true);
  assert.equal(filled.summary.fallbackCards, 1);

  const strict = { dailyTop3: [{ eventId: "strict" }], summary: { totalCards: 1 } };
  assert.equal(withVisibleDailyTop3(strict, observations), strict);
});

test("scorecaster app API exposes fallback observations while preserving public boundaries", async () => {
  const api = await file("app/api/scorecaster-app/route.js");
  assert.match(api, /buildVisibleObservations/);
  assert.match(api, /withVisibleDailyTop3/);
  assert.match(api, /visibleObservations/);
  assert.match(api, /strictDailyTop3Count/);
  assert.match(api, /\.eq\("publishable", true\)/);
});

test("profile is useful in local mode and no longer exposes Production Status", async () => {
  const [page, overview] = await Promise.all([
    file("app/profile/page.jsx"),
    file("app/profile/ProfileOverviewClient.jsx")
  ]);
  assert.match(page, /ProfileOverviewClient/);
  assert.doesNotMatch(page, /Production Status|production-status/);
  assert.match(overview, /AI Coach/);
  assert.match(overview, /getTrackedBets/);
  assert.match(overview, /calculateTrackingStats/);
  assert.match(overview, /saveSettings/);
});

test("event cards expose reasoning and continue through verified paper tracking", async () => {
  const [events, explanation] = await Promise.all([
    file("app/events/EventsClient.jsx"),
    file("app/components/MarketPickExplanation.jsx")
  ]);
  assert.match(events, /MarketPickExplanation/);
  assert.match(events, /Avaa ottelu ja analyysi/);
  assert.match(events, /<Link href=\{href\} className="sc-button-primary/);
  assert.doesNotMatch(events, /addTrackedBet/);
  assert.match(explanation, /p_market = 1 \/ odds/);
  assert.match(explanation, /edge = p_consensus/);
  assert.match(explanation, /EV = p_consensus/);
  assert.match(explanation, /\/transparency/);
});

test("operator tools are collapsed and mobile heroes use narrower typography", async () => {
  const [shell, product] = await Promise.all([
    file("app/components/AppShell.jsx"),
    file("app/components/ProductUI.jsx")
  ]);
  assert.match(shell, /<details className="mt-4 border-t/);
  assert.match(shell, /Developer and operator tools/);
  assert.match(product, /clamp\(2rem,8vw,4\.6rem\)/);
  assert.match(product, /rounded-\[1\.75rem\]/);
});

test("premium homepage V3 is compact, mobile-first and keeps paper-only truthfulness", async () => {
  const today = await file("app/components/TodayPageV3.jsx");
  assert.match(today, /data-homepage-v3="mobile-first"/);
  assert.match(today, /REAL DATA · PAPER ONLY/);
  assert.match(today, /Top AI Picks/);
  assert.match(today, /Match Hub/);
  assert.match(today, /Paper Slip/);
  assert.match(today, /Market Insights/);
  assert.match(today, /Intelligence Edge/);
  assert.match(today, /lg:grid-cols-\[minmax\(240px,.78fr\)_minmax\(390px,1.32fr\)_minmax\(250px,.82fr\)\]/);
  assert.match(today, /\/api\/recommendations\?limit=20/);
  assert.match(today, /independentModelProbability/);
  assert.match(today, /marketProbability/);
  assert.match(today, /PAPER ONLY/);
  assert.match(today, /Ei vedonvälittäjä\. Ei lähetä vetoa eikä siirrä rahaa\./);
  assert.match(today, /eivät toteutunutta ROI:ta tai luvattua voittoprosenttia/);
  assert.doesNotMatch(today, /\bPlace Bet\b|potential return|Avg\. ROI|92% Confidence/i);
});
