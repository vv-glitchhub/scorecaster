import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildCollectorCoverage,
  buildCollectorEventSummaries,
  buildCollectorInsights,
  buildCollectorSourceQuality,
  buildCollectorTimeSeries,
  detectCollectorIncidents
} from "../lib/collector-insights.mjs";

const root = new URL("../", import.meta.url);
const file = (path) => readFile(new URL(path, root), "utf8");
const now = new Date("2026-07-27T12:00:00.000Z").getTime();

const records = [
  { sourceId: "scorecaster_internal", eventId: "evt-1", sport: "ice_hockey", league: "NHL", metric: "best_odds", value: 2.1, unit: "decimal_odds", confidence: 0.9, sourceTrust: 0.95, observedAt: "2026-07-27T11:20:00.000Z", collectedAt: "2026-07-27T11:25:00.000Z" },
  { sourceId: "scorecaster_internal", eventId: "evt-1", sport: "ice_hockey", league: "NHL", metric: "market_probability", value: 0.48, unit: "probability", confidence: 0.88, sourceTrust: 0.95, observedAt: "2026-07-27T11:20:00.000Z", collectedAt: "2026-07-27T11:25:00.000Z" },
  { sourceId: "licensed_api", eventId: "evt-1", sport: "ice_hockey", league: "NHL", metric: "xg", value: 1.7, unit: "goals", confidence: 0.8, sourceTrust: 0.85, observedAt: "2026-07-27T11:30:00.000Z", collectedAt: "2026-07-27T11:35:00.000Z" },
  { sourceId: "scorecaster_internal", eventId: "evt-2", sport: "basketball", league: "NBA", metric: "best_odds", value: 1.91, unit: "decimal_odds", confidence: 0.92, sourceTrust: 0.95, observedAt: "2026-07-27T11:40:00.000Z", collectedAt: "2026-07-27T11:45:00.000Z" }
];

test("Collector V2 builds time buckets and coverage", () => {
  const series = buildCollectorTimeSeries(records, { bucketMinutes: 30 });
  assert.equal(series.length, 2);
  assert.equal(series.reduce((sum, item) => sum + item.records, 0), 4);
  const coverage = buildCollectorCoverage(records);
  assert.deepEqual(coverage.totals, { records: 4, events: 2, sources: 2, metrics: 3, sports: 2 });
  assert.equal(coverage.sports[0].sport, "ice_hockey");
});

test("Collector V2 grades source quality using freshness and provenance", () => {
  const quality = buildCollectorSourceQuality(records, { now });
  const internal = quality.find((source) => source.sourceId === "scorecaster_internal");
  assert.ok(internal.score >= 80);
  assert.ok(["A", "B"].includes(internal.grade));
  assert.equal(internal.status, "fresh");
  assert.equal(internal.events, 2);
  assert.equal(internal.trust, 0.95);
});

test("Collector V2 event summaries retain latest metrics", () => {
  const events = buildCollectorEventSummaries(records, { limit: 10 });
  const event = events.find((item) => item.eventId === "evt-1");
  assert.equal(event.records, 3);
  assert.equal(event.sources, 2);
  assert.equal(event.metrics, 3);
  assert.equal(event.latestMetrics.xg.value, 1.7);
});

test("Collector V2 incidents detect stale and low-quality sources", () => {
  const staleRecords = [{ ...records[0], sourceId: "weak", sourceTrust: 0.3, confidence: 0.4, collectedAt: "2026-07-26T00:00:00.000Z" }];
  const sourceQuality = buildCollectorSourceQuality(staleRecords, { now });
  const coverage = buildCollectorCoverage(staleRecords);
  const incidents = detectCollectorIncidents({ records: staleRecords, sourceQuality, coverage, now });
  assert.ok(incidents.some((incident) => incident.code === "capture-stale"));
  assert.ok(incidents.some((incident) => incident.code === "source-low-trust:weak"));
  assert.ok(incidents.some((incident) => incident.code === "source-low-confidence:weak"));
});

test("Collector V2 insight bundle keeps safety boundaries", () => {
  const insights = buildCollectorInsights(records, { now, bucketMinutes: 30 });
  assert.equal(insights.coverage.totals.records, 4);
  assert.equal(insights.safety.publishableOnly, true);
  assert.equal(insights.safety.researchDataExcluded, true);
  assert.equal(insights.safety.probabilityChanged, false);
  assert.equal(insights.safety.paperOnly, true);
});

test("Collector V2 APIs, export, maintenance and UI expose governed features", async () => {
  const [api, eventApi, exportApi, maintenance, client] = await Promise.all([
    file("app/api/collector/route.js"),
    file("app/api/collector/event/[eventId]/route.js"),
    file("app/api/collector/export/route.js"),
    file("app/api/internal/collector/maintenance/route.js"),
    file("app/data-collector/DataCollectorClient.jsx")
  ]);
  assert.match(api, /scorecaster-collector-api-v2/);
  assert.match(api, /buildCollectorInsights/);
  assert.match(api, /\.eq\("publishable", true\)/);
  assert.match(eventApi, /scorecaster-collector-event-v1/);
  assert.match(eventApi, /\.eq\("event_id", eventId\)/);
  assert.match(exportApi, /text\/csv/);
  assert.match(exportApi, /attachment; filename/);
  assert.match(maintenance, /scorecaster-collector-maintenance-v1/);
  assert.match(maintenance, /apply \? "apply" : "dry-run"/);
  assert.match(maintenance, /probabilityChanged: false/);
  assert.match(client, /Scorecaster Collector V2/);
  assert.match(client, /Lataa CSV/);
  assert.match(client, /Automaattiset incidentit/);
  assert.match(client, /Tapahtuman drilldown/);
});
