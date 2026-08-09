import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  normalizeStoredProviderObservation,
  normalizeStoredProviderObservations
} from "../lib/provider-observation-normalization-v1.mjs";

test("live SportsGameOdds match confidence is retained only as bounded numeric telemetry", () => {
  const row = normalizeStoredProviderObservation({
    family: "odds",
    mode: "live",
    ok: true,
    confidence: null,
    details: { matchConfidence: 0.91371, candidateCount: 28 }
  });
  assert.equal(row.ok, true);
  assert.equal(row.confidence, 0.914);
});

test("nested match confidence is accepted but invalid values fail closed to null", () => {
  const rows = normalizeStoredProviderObservations([
    { family: "odds", mode: "low_match_confidence", ok: true, details: { data: { matchConfidence: 0.6814 } } },
    { family: "odds", mode: "live", ok: true, details: { matchConfidence: 1.3 } },
    { family: "odds", mode: "live", ok: true, details: { matchConfidence: "not-a-number" } }
  ]);
  assert.equal(rows[0].confidence, 0.681);
  assert.equal(rows[1].confidence, null);
  assert.equal(rows[2].confidence, null);
});

test("non-live odds failure modes cannot remain operationally healthy", () => {
  for (const mode of ["no_match", "low_match_confidence", "unsupported_league", "not_configured", "api_error", "fetch_error", "timeout", "not_verified", "unavailable"]) {
    const row = normalizeStoredProviderObservation({ family: "odds", mode, ok: true });
    assert.equal(row.ok, false, mode);
  }
});

test("non-odds observations keep their operational status and bounded confidence", () => {
  const row = normalizeStoredProviderObservation({ family: "weather", mode: "live", ok: true, confidence: 0.87 });
  assert.equal(row.ok, true);
  assert.equal(row.confidence, 0.87);
});

test("normalization never invents a successful observation", () => {
  const row = normalizeStoredProviderObservation({ family: "odds", mode: "live", ok: false, details: { matchConfidence: 0.99 } });
  assert.equal(row.ok, false);
  assert.equal(row.confidence, 0.99);
});

test("unified data service forwards only bounded SportsGameOdds confidence and allowlisted rejection diagnostics", async () => {
  const service = await readFile(new URL("../lib/unified-sports-data-service.js", import.meta.url), "utf8");
  assert.match(service, /function boundedConfidence\(value\)/);
  assert.match(service, /number < 0 \|\| number > 1/);
  assert.match(service, /matchConfidence:\s*boundedConfidence\(secondaryOdds\.matchConfidence \?\? secondaryOdds\.data\?\.matchConfidence\)/);
  assert.match(service, /safeSportsGameOddsMatchDiagnostics\(secondaryOdds\.matchDiagnostics\)/);
  const providerSection = service.match(/providers:\s*\{([\s\S]*?)\n\s*\},\n\s*raw:/)?.[1] || "";
  assert.match(providerSection, /secondaryOdds:/);
  assert.match(providerSection, /matchDiagnostics:/);
  assert.doesNotMatch(providerSection, /candidateCount|providerHomeTeam|providerAwayTeam|eventId\s*:|rawProvider|apiKey/i);
});

test("unified data library normalizes provider observations before the worker upsert boundary", async () => {
  const library = await readFile(new URL("../lib/unified-sports-data-v2.mjs", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/internal/unified-data/route.js", import.meta.url), "utf8");
  assert.match(library, /normalizeStoredProviderObservation/);
  assert.match(library, /observations\.push\(normalizeStoredProviderObservation\(\{/);
  assert.match(route, /observations\.push\(\.\.\.buildProviderObservations/);
  assert.match(route, /unified_data_provider_observations/);
  assert.doesNotMatch(route, /provider-observation-normalization-v1/);
});
