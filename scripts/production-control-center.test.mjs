import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { calibrationMetrics, closingLineReport, rankDailyTop3, modelComparison, buildProductionControlCenter } from "../lib/production-control-center.mjs";

const root = new URL("../", import.meta.url);
const file = (path) => readFile(new URL(path, root), "utf8");
const now = Date.parse("2026-07-28T12:00:00.000Z");
const records = [
  { eventId:"evt-1", sourceId:"a", metric:"market_probability", value:.52, observedAt:"2026-07-28T11:00:00.000Z", confidence:.9, sourceTrust:.95 },
  { eventId:"evt-1", sourceId:"b", metric:"model_probability", value:.60, observedAt:"2026-07-28T11:05:00.000Z", confidence:.88, sourceTrust:.9 },
  { eventId:"evt-1", sourceId:"a", metric:"best_odds", value:2.1, observedAt:"2026-07-28T10:00:00.000Z", confidence:.9, sourceTrust:.95 },
  { eventId:"evt-1", sourceId:"a", metric:"best_odds", value:1.95, observedAt:"2026-07-28T11:10:00.000Z", confidence:.9, sourceTrust:.95 },
  { eventId:"evt-2", sourceId:"a", metric:"market_probability", value:.55, observedAt:"2026-07-28T11:00:00.000Z", confidence:.8, sourceTrust:.9 },
  { eventId:"evt-2", sourceId:"b", metric:"model_probability", value:.57, observedAt:"2026-07-28T11:02:00.000Z", confidence:.8, sourceTrust:.85 },
  { eventId:"evt-3", sourceId:"a", metric:"market_probability", value:.50, observedAt:"2026-07-28T11:00:00.000Z", confidence:.8, sourceTrust:.9 }
];

test("calibration computes bounded proper scores", () => {
  const result = calibrationMetrics([{ probability:.7, result:1 }, { probability:.6, result:0 }, { probability:.2, result:0 }]);
  assert.equal(result.count, 3);
  assert.ok(result.brier >= 0 && result.brier <= 1);
  assert.ok(result.logLoss > 0);
  assert.equal(result.grade, "D");
});

test("closing line report uses chronological first and last prices", () => {
  const result = closingLineReport(records);
  assert.equal(result.count, 1);
  assert.equal(result.events[0].openingOdds, 2.1);
  assert.equal(result.events[0].closingOdds, 1.95);
});

test("Daily Top 3 ranks evidence without PLAY upgrades", () => {
  const picks = rankDailyTop3(records, now);
  assert.ok(picks.length <= 3);
  assert.equal(picks[0].eventId, "evt-1");
  assert.ok(["WATCH", "CAUTION", "SKIP"].includes(picks[0].decision));
  assert.notEqual(picks[0].decision, "PLAY");
});

test("model comparison remains evidence based", () => {
  const models = modelComparison(records);
  assert.equal(models.length, 3);
  assert.equal(models.find(m=>m.metric==="simulation_probability").grade, "N/A");
});

test("readiness blocks under-sampled production", () => {
  const result = buildProductionControlCenter({ records, settledSamples:[], collectorHealth:{ status:"healthy" }, now });
  assert.equal(result.readiness.status, "blocked");
  assert.ok(result.readiness.blockers.includes("calibration-sample-below-300"));
  assert.equal(result.safety.paperOnly, true);
  assert.equal(result.safety.productionProbabilityChanged, false);
});

test("API and page preserve publishable-only and paper boundaries", async () => {
  const [api, client, page] = await Promise.all([
    file("app/api/production-control-center/route.js"),
    file("app/production-control-center/ProductionControlCenterClient.jsx"),
    file("app/production-control-center/page.jsx")
  ]);
  assert.match(api, /\.eq\("publishable", true\)/);
  assert.match(api, /collector_records/);
  assert.match(client, /Daily Top 3/);
  assert.match(client, /ei aseta vetoja/i);
  assert.match(page, /Production Control Center/);
});
