import test from "node:test";
import assert from "node:assert/strict";
import { auditModelLineageV1, MODEL_LINEAGE_GUARD_VERSION } from "../lib/model-lineage-guard-v1.mjs";

function candidate(overrides = {}) {
  return {
    modelId: "advanced-shadow-v1",
    modelVersion: "advanced-shadow-v1",
    dependenceGroup: "self-declared-independent-family",
    signalFamilies: ["expected-performance"],
    dataLineage: {
      providers: ["advanced-provider"],
      metrics: ["xg", "shot-quality"]
    },
    ...overrides
  };
}

test("expected-performance lineage derives a sport-specific independent signal family", () => {
  const result = auditModelLineageV1(candidate(), { sportKey: "icehockey_nhl" });
  assert.equal(result.version, MODEL_LINEAGE_GUARD_VERSION);
  assert.equal(result.ok, true);
  assert.equal(result.dependenceGroup, "icehockey_nhl-expected-performance-family");
  assert.deepEqual(result.signalFamilies, ["expected-performance"]);
  assert.ok(result.warnings.includes("claimed-dependence-group-overridden-by-lineage"));
  assert.equal(result.policy.dependenceGroupSelfDeclared, false);
});

test("historical lineage conservatively dominates a mixed historical plus expected model", () => {
  const result = auditModelLineageV1(candidate({ signalFamilies: ["xg", "historical-results"] }), { sportKey: "soccer_epl" });
  assert.equal(result.ok, true);
  assert.equal(result.dependenceGroup, "soccer_epl-historical-results-family");
  assert.deepEqual(result.signalFamilies, ["expected-performance", "historical-results"]);
  assert.equal(result.policy.historicalSignalDominatesMixedDependenceGrouping, true);
});

test("market-derived signal cannot masquerade as an independent model", () => {
  const result = auditModelLineageV1(candidate({ signalFamilies: ["odds-consensus", "xg"] }), { sportKey: "soccer_epl" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("market-derived-signal-not-independent"));
  assert.equal(result.policy.marketDerivedIndependentModelAllowed, false);
});

test("context-only models cannot become an independent ensemble vote", () => {
  const result = auditModelLineageV1(candidate({ signalFamilies: ["injury", "weather", "travel"] }), { sportKey: "baseball_mlb" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("context-only-signal-not-independent"));
  assert.equal(result.dependenceGroup, "baseball_mlb-context-derived-family");
});

test("missing signal lineage fails closed", () => {
  const result = auditModelLineageV1(candidate({ signalFamilies: [], dataLineage: {} }), { sportKey: "basketball_nba" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("missing-signal-lineage"));
  assert.ok(result.errors.includes("dependence-group-could-not-be-derived"));
});

test("lineage fingerprints are deterministic and include providers and metrics", () => {
  const left = auditModelLineageV1(candidate(), { sportKey: "icehockey_nhl" });
  const right = auditModelLineageV1(candidate({ dataLineage: { providers: ["advanced-provider"], metrics: ["shot-quality", "xg"] } }), { sportKey: "icehockey_nhl" });
  const changed = auditModelLineageV1(candidate({ dataLineage: { providers: ["other-provider"], metrics: ["shot-quality", "xg"] } }), { sportKey: "icehockey_nhl" });
  assert.equal(left.lineageFingerprint, right.lineageFingerprint);
  assert.notEqual(left.lineageFingerprint, changed.lineageFingerprint);
});
