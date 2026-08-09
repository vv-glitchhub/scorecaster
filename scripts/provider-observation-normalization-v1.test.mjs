import test from "node:test";
import assert from "node:assert/strict";
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
    { family: "odds", mode: "live", ok: true, details: { matchConfidence: "secret-text" } }
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
