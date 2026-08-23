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
  assert.match(events, /Tarkista ja valitse toiminto/);
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
