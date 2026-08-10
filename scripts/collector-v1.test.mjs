import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { collectorRegistrySummary, getCollectorSource, sourceCanCollect, sourceCanPublish } from "../lib/collector-source-registry.mjs";
import { normalizeCollectorBatch, normalizeCollectorRecord, scorecasterPicksToCollectorRecords } from "../lib/collector-normalize.mjs";

const root = new URL("../", import.meta.url);
const file = (path) => readFile(new URL(path, root), "utf8");

test("collector registry is fail-closed for research and unknown sources", () => {
  const registry = collectorRegistrySummary({});
  assert.ok(registry.total >= 4);
  const internal = getCollectorSource("scorecaster_internal", {});
  const research = getCollectorSource("statsbomb_open", {});
  assert.equal(sourceCanCollect(internal).allowed, true);
  assert.equal(sourceCanPublish(internal).allowed, true);
  assert.equal(sourceCanCollect(research).allowed, false);
  assert.equal(sourceCanPublish(research).allowed, false);
  assert.equal(getCollectorSource("unknown", {}), null);
});

test("configured API cannot enter production without explicit rights flags", () => {
  const env = {
    NODE_ENV: "production",
    COLLECTOR_JSON_API_URL: "https://provider.example.test/records",
    COLLECTOR_JSON_ENABLED: "true",
    COLLECTOR_JSON_ACCESS_MODE: "production",
    COLLECTOR_JSON_COMMERCIAL_ALLOWED: "false"
  };
  const source = getCollectorSource("configured_json_api", env);
  const permission = sourceCanCollect(source, { production: true });
  assert.equal(Boolean(source?.baseUrl), true);
  assert.equal(permission.allowed, false);
  assert.equal(permission.reason, "commercial-rights-not-confirmed");
});

test("collector normalizes, fingerprints and deduplicates records", () => {
  const input = {
    eventId: "evt-1",
    sport: "NHL",
    metric: "best odds",
    value: 2.1,
    unit: "decimal_odds",
    observedAt: "2026-01-01T12:00:00.000Z"
  };
  const one = normalizeCollectorRecord(input, { sourceId: "scorecaster_internal", collectedAt: "2026-01-01T12:05:00.000Z", env: {} });
  assert.equal(one.ok, true);
  assert.equal(one.record.sport, "ice_hockey");
  assert.equal(one.record.metric, "best_odds");
  assert.equal(one.record.publishable, true);
  assert.equal(one.record.paper_only, true);
  assert.equal(one.record.fingerprint.length, 64);

  const batch = normalizeCollectorBatch([input, input], { sourceId: "scorecaster_internal", collectedAt: "2026-01-01T12:05:00.000Z", env: {} });
  assert.equal(batch.received, 2);
  assert.equal(batch.accepted, 1);
  assert.equal(batch.publishable, 1);
});

test("collector rejects missing identifiers and future timestamps", () => {
  const missing = normalizeCollectorRecord({ metric: "xg" }, { sourceId: "scorecaster_internal", env: {} });
  assert.equal(missing.ok, false);
  assert.equal(missing.error, "missing-event-id");
  const future = normalizeCollectorRecord({ eventId: "evt", metric: "xg", observedAt: "2099-01-01T00:00:00.000Z" }, { sourceId: "scorecaster_internal", env: {} });
  assert.equal(future.ok, false);
  assert.equal(future.error, "invalid-observed-at");
});

test("Scorecaster picks become first-party publishable records", () => {
  const result = scorecasterPicksToCollectorRecords([{
    gameId: "game-7",
    sportKey: "basketball_nba",
    homeTeam: "Home",
    awayTeam: "Away",
    commenceTime: "2026-01-01T18:00:00.000Z",
    bestOdds: 1.91,
    marketProbability: 0.52,
    decision: "CAUTION"
  }], "2026-01-01T12:00:00.000Z");
  assert.equal(result.records.length, 3);
  assert.ok(result.records.every((row) => row.publishable && row.paper_only));
});

test("collector storage and APIs retain security boundaries", async () => {
  const [sql, worker, importer, api, health, sources, workflow, client, provider] = await Promise.all([
    file("supabase/scorecaster_collector_v1.sql"),
    file("app/api/internal/collector/route.js"),
    file("app/api/internal/collector/import/route.js"),
    file("app/api/collector/route.js"),
    file("app/api/collector/health/route.js"),
    file("app/api/collector/sources/route.js"),
    file(".github/workflows/collector.yml"),
    file("app/data-collector/DataCollectorClient.jsx"),
    file("lib/collector-json-provider.js")
  ]);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /revoke all.*anon, authenticated/i);
  assert.match(worker, /Authorization|authorization/);
  assert.match(worker, /probabilityChanged: false/);
  assert.match(importer, /rightsConfirmed/);
  assert.match(importer, /licenseReference/);
  assert.match(api, /\.eq\("publishable", true\)/);
  assert.match(api, /researchDataExcluded: true/);
  assert.match(health, /scorecaster-collector-health-v3/);
  assert.match(sources, /productionCollectionFailsClosed: true/);
  assert.match(workflow, /api\/internal\/collector/);
  assert.match(workflow, /api\/internal\/unified-data/);
  assert.match(workflow, /api\/internal\/sports-analytics/);
  assert.match(workflow, /timeout-minutes:\s*12/);
  assert.match(client, /publishable-only API/);
  assert.match(provider, /https-required/);
});
