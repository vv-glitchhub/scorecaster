import test from "node:test";
import assert from "node:assert/strict";
import {
  applyProviderReadinessTelemetry,
  buildProviderReadinessInput,
  normalizePricingProviderObservations,
  normalizeReadinessIncidents
} from "../lib/provider-readiness-input-v1.mjs";

const NOW = "2026-08-09T04:00:00.000Z";

function observation({ provider, family = "odds", mode = "live", ok = true, event = "event-1", trust = 0.9 } = {}) {
  return {
    event_id: event,
    provider_key: provider,
    family,
    mode,
    ok,
    trust,
    confidence: 0.9,
    observed_at: NOW,
    captured_at: NOW
  };
}

test("unsupported odds leagues are excluded from provider availability denominator", () => {
  const result = normalizePricingProviderObservations([
    observation({ provider: "the-odds-api" }),
    observation({ provider: "sportsgameodds", mode: "unsupported_league" })
  ]);
  assert.equal(result.eligible.length, 1);
  assert.equal(result.eligible[0].provider_key, "the-odds-api");
  assert.equal(result.excluded.length, 1);
  assert.equal(result.excluded[0].mode, "unsupported_league");
});

test("secondary no-match and low-confidence outcomes count as unavailable pricing evidence", () => {
  const result = normalizePricingProviderObservations([
    observation({ provider: "sportsgameodds", event: "event-1", mode: "no_match" }),
    observation({ provider: "sportsgameodds", event: "event-2", mode: "low_match_confidence" }),
    observation({ provider: "sportsgameodds", event: "event-3", mode: "live" })
  ]);
  assert.equal(result.eligible.length, 3);
  assert.deepEqual(result.eligible.map((row) => row.ok), [false, false, true]);
});

test("optional global provider-health incidents cannot become pricing hard-disable input", () => {
  const result = normalizeReadinessIncidents([
    { incident_type: "provider_health", severity: "high", provider_key: "unavailable", details: { family: "injuries" }, active: true },
    { incident_type: "provider_health", severity: "high", provider_key: "sportsgameodds", details: { family: "odds" }, active: true },
    { incident_type: "adverse_verified_context", severity: "high", event_id: "event-1", details: { family: "injuries" }, active: true }
  ]);
  assert.equal(result.readiness.length, 2);
  assert.equal(result.optionalProviderHealth.length, 1);
  assert.equal(result.optionalProviderHealth[0].provider_key, "unavailable");
  assert.ok(result.readiness.some((row) => row.provider_key === "sportsgameodds"));
  assert.ok(result.readiness.some((row) => row.event_id === "event-1"));
});

test("pricing readiness telemetry keeps optional providers visible without mixing denominators", () => {
  const input = buildProviderReadinessInput({
    providerObservations: [
      observation({ provider: "the-odds-api", event: "event-1" }),
      observation({ provider: "sportsgameodds", event: "event-1", mode: "live" }),
      observation({ provider: "sportsgameodds", event: "event-2", mode: "no_match" }),
      observation({ provider: "open-meteo", family: "weather", event: "event-1", mode: "live" }),
      observation({ provider: "sports-context-provider", family: "context", event: "event-1", mode: "unavailable", ok: false }),
      observation({ provider: "unavailable", family: "injuries", event: "event-1", mode: "unavailable", ok: false })
    ],
    incidents: [
      { incident_type: "provider_health", severity: "high", provider_key: "sports-context-provider", details: { family: "context" }, active: true }
    ]
  });

  assert.equal(input.telemetry.allProviderCount, 5);
  assert.equal(input.telemetry.oddsProviderCount, 2);
  assert.equal(input.telemetry.optionalProviderCount, 3);
  assert.equal(input.telemetry.averageOddsProviderAvailability, 0.75);
  assert.equal(input.telemetry.averageAllProviderAvailability, 0.6);
  assert.equal(input.telemetry.optionalProviderHealthIncidentCount, 1);
  assert.equal(input.readinessIncidents.length, 0);

  const report = applyProviderReadinessTelemetry({
    summary: { averageProviderAvailability: 0.75, activeIncidents: 0 },
    providers: input.pricingProviderEvidence,
    safety: { paperOnly: true }
  }, input);
  assert.equal(report.providers.length, 5);
  assert.equal(report.summary.averageProviderAvailability, 0.75);
  assert.equal(report.summary.averageAllProviderAvailability, 0.6);
  assert.equal(report.summary.optionalProviderHealthIncidents, 1);
  assert.equal(report.providerReadiness.semantics.multiProviderCoverageRemainsIndependent, true);
});

test("provider readiness input never changes thresholds or paper-only safety boundary", () => {
  const input = buildProviderReadinessInput({ providerObservations: [], incidents: [] });
  assert.equal(input.safety.paperOnly, true);
  assert.equal(input.safety.realMoneyExecution, false);
  assert.equal(input.safety.bookmakerCredentials, false);
  assert.equal(input.safety.thresholdsChanged, false);
  assert.equal(input.safety.multiProviderCoverageChanged, false);
  assert.equal(input.safety.missingEvidenceImputed, false);
});
