import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  SOURCE_REGISTRY_VERSION,
  getCollectorSource,
  sourceCanPublish
} from "../lib/collector-source-registry.mjs";
import {
  assertPublicSourceRecords,
  publicSourceRegistry,
  publicSourceRegistrySummary,
  sanitizePublicSourceRecord,
  sourceFreshness,
  sourcePublicationDecision
} from "../lib/source-governance.mjs";

const root = new URL("../", import.meta.url);
const file = (path) => readFile(new URL(path, root), "utf8");
const NOW = Date.parse("2026-08-05T03:00:00.000Z");

const productionEnv = {
  ODDS_API_KEY: "test-key-present",
  COLLECTOR_JSON_API_URL: "https://provider.example.test/data",
  COLLECTOR_JSON_ENABLED: "true",
  COLLECTOR_JSON_ACCESS_MODE: "production",
  COLLECTOR_JSON_COMMERCIAL_ALLOWED: "true",
  COLLECTOR_JSON_REDISTRIBUTION_ALLOWED: "false",
  COLLECTOR_JSON_TRAINING_ALLOWED: "false",
  COLLECTOR_JSON_ATTRIBUTION_REQUIRED: "true",
  COLLECTOR_JSON_ATTRIBUTION: "Example Provider",
  COLLECTOR_JSON_PUBLIC_FIELDS: "sourceId,eventId,metric,value,observedAt",
  COLLECTOR_JSON_RESTRICTED_FIELDS: "rawPayload,apiKey,headers"
};

test("registry is versioned and contains governed production and research sources", () => {
  const summary = publicSourceRegistrySummary(productionEnv);
  assert.equal(summary.version, SOURCE_REGISTRY_VERSION);
  assert.ok(summary.total >= 6);
  assert.ok(summary.sources.some((source) => source.id === "the_odds_api"));
  assert.ok(summary.sources.some((source) => source.status === "research-only"));
  assert.equal(summary.rawPayloadsPublic, 0);
});

test("The Odds API metadata is public but credentials and base URL are not", () => {
  const source = publicSourceRegistry(productionEnv).find((item) => item.id === "the_odds_api");
  assert.ok(source);
  assert.equal(source.enabled, true);
  assert.equal(source.attributionRequired, true);
  assert.equal(source.redistributionAllowed, false);
  assert.equal(source.rawPayloadPublic, false);
  assert.equal(Object.hasOwn(source, "baseUrl"), false);
  assert.equal(JSON.stringify(source).includes("test-key-present"), false);
});

test("research, disabled and unknown sources fail closed", () => {
  assert.equal(sourceCanPublish(getCollectorSource("statsbomb_open", productionEnv)).allowed, false);
  assert.equal(sourceCanPublish(getCollectorSource("unknown", productionEnv)).allowed, false);
  assert.equal(sourceCanPublish(getCollectorSource("the_odds_api", {})).allowed, false);

  const unknown = sanitizePublicSourceRecord({ sourceId: "unknown", eventId: "evt", metric: "xg", value: 1 }, productionEnv);
  const research = sanitizePublicSourceRecord({ sourceId: "statsbomb_open", eventId: "evt", metric: "xg", value: 1 }, productionEnv);
  assert.equal(unknown.ok, false);
  assert.equal(unknown.reason, "unknown-source");
  assert.equal(research.ok, false);
  assert.equal(research.reason, "research-only");
});

test("field firewall strips secrets and raw provider payloads", () => {
  const result = sanitizePublicSourceRecord({
    sourceId: "the_odds_api",
    eventId: "evt-1",
    sport: "soccer",
    metric: "best_odds",
    value: 2.1,
    observedAt: "2026-08-05T02:55:00.000Z",
    confidence: 0.9,
    sourceTrust: 0.8,
    apiKey: "never-public",
    rawPayload: { bookmaker: "raw" },
    headers: { authorization: "secret" },
    email: "private@example.test"
  }, productionEnv);

  assert.equal(result.ok, true);
  assert.equal(result.record.value, 2.1);
  assert.equal(result.record.attribution, "Market odds: The Odds API");
  assert.equal(Object.hasOwn(result.record, "apiKey"), false);
  assert.equal(Object.hasOwn(result.record, "rawPayload"), false);
  assert.ok(result.strippedFields.includes("apiKey"));
  assert.ok(result.strippedFields.includes("rawPayload"));
  assert.equal(JSON.stringify(result).includes("never-public"), false);
});

test("configured sources expose only explicitly registered normalized fields", () => {
  const decision = sourcePublicationDecision("configured_json_api", ["sourceId", "eventId", "metric", "value"], productionEnv);
  const blocked = sourcePublicationDecision("configured_json_api", ["sourceId", "requestUrl", "rawPayload"], productionEnv);
  assert.equal(decision.allowed, true);
  assert.equal(blocked.allowed, false);
  assert.deepEqual(blocked.blockedFields.sort(), ["rawPayload", "requestUrl"].sort());
});

test("freshness is deterministic and provider-specific", () => {
  const fresh = sourceFreshness("the_odds_api", "2026-08-05T02:50:00.000Z", NOW, productionEnv);
  const aging = sourceFreshness("the_odds_api", "2026-08-05T02:40:00.000Z", NOW, productionEnv);
  const stale = sourceFreshness("the_odds_api", "2026-08-05T02:20:00.000Z", NOW, productionEnv);
  assert.equal(fresh.status, "fresh");
  assert.equal(aging.status, "aging");
  assert.equal(stale.status, "stale");
  assert.equal(fresh.thresholdMinutes, 15);
});

test("batch firewall reports rejected sources without publishing replacements", () => {
  const result = assertPublicSourceRecords([
    { sourceId: "scorecaster_internal", eventId: "evt-1", metric: "model_probability", value: 0.55 },
    { sourceId: "unknown", eventId: "evt-1", metric: "injury", value: 1 }
  ], productionEnv);
  assert.equal(result.ok, false);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].reason, "unknown-source");
});

test("public API and UI disclose governance without exposing server configuration", async () => {
  const [api, page, client, registry, docs] = await Promise.all([
    file("app/api/sources/route.js"),
    file("app/sources/page.jsx"),
    file("app/sources/SourceRegistryClient.jsx"),
    file("lib/collector-source-registry.mjs"),
    file("docs/SOURCE_REGISTRY_V1.md")
  ]);
  assert.match(api, /Access-Control-Allow-Origin/);
  assert.match(api, /unregisteredFieldsBlocked: true/);
  assert.match(api, /rawPayloadsPublished: false/);
  assert.match(page, /SourceRegistryClient/);
  assert.match(client, /Fail-closed/);
  assert.match(client, /\/api\/sources/);
  assert.match(registry, /rawPayloadPublic: false/);
  assert.match(registry, /the-odds-api\.com\/terms-and-conditions\.html/);
  assert.match(docs, /No API key/);
  assert.doesNotMatch(api, /ODDS_API_KEY|COLLECTOR_JSON_API_URL/);
});
