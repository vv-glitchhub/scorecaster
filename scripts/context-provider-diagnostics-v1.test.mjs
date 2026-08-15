import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildContextProviderDiagnostics } from "../lib/context-provider-diagnostics-v1.mjs";
import { applyProviderReadinessTelemetry, buildProviderReadinessInput } from "../lib/provider-readiness-input-v1.mjs";

const NOW = "2026-08-15T03:30:00.000Z";

function row(overrides = {}) {
  return {
    event_id: "private-event-id",
    provider_key: "sportsdata",
    family: "injuries",
    mode: "subscription_unavailable",
    ok: false,
    details: {
      source: "sportsdata",
      mode: "subscription_unavailable",
      status: 401,
      path: "/v3/wnba/scores/JSON/Players?key=must-never-surface",
      subscriptionUnavailable: true,
      coverageChecked: false,
      credential: "must-never-surface",
      rawPayload: { secret: "must-never-surface" }
    },
    captured_at: NOW,
    ...overrides
  };
}

test("context diagnostics classify subscription and lineup blockers without event or credential leakage", () => {
  const report = buildContextProviderDiagnostics([
    row(),
    row({
      family: "lineups",
      provider_key: "sportsdata",
      mode: "not_confirmed",
      details: {
        mode: "not_confirmed",
        source: "sportsdata",
        status: 200,
        path: "/v4/soccer/stats/JSON/BoxScoresByDate/8/2026-AUG-15",
        coverageChecked: true,
        starterCounts: { home: 10, away: 11 },
        fallbackAttempted: true,
        fallbackUsed: false,
        fallbackMode: "not_confirmed"
      }
    }),
    row({ family: "news", provider_key: "newsapi", mode: "live", ok: true, details: { source: "newsapi", mode: "live", ok: true, count: 4 } }),
    row({ family: "weather", provider_key: "open-meteo", mode: "not_applicable_indoor", ok: true, details: { source: "open-meteo", mode: "not_applicable_indoor", ok: true } })
  ]);

  assert.deepEqual(report.summary.subscriptionBlockedFamilies, ["injuries"]);
  assert.ok(report.summary.blockedFamilies.includes("injuries"));
  const injury = report.families.find((item) => item.family === "injuries");
  const lineup = report.families.find((item) => item.family === "lineups");
  const news = report.families.find((item) => item.family === "news");
  const weather = report.families.find((item) => item.family === "weather");
  assert.equal(injury.state, "blocked");
  assert.equal(injury.latest.status, 401);
  assert.equal(injury.latest.path, "/v3/wnba/scores/JSON/Players");
  assert.equal(lineup.latest.starterCounts.home, 10);
  assert.equal(lineup.latest.starterCounts.away, 11);
  assert.equal(lineup.state, "blocked");
  assert.equal(news.state, "available");
  assert.equal(weather.state, "not-applicable");
  assert.equal(report.safety.eventIdsExposed, false);
  assert.equal(report.safety.credentialsRetained, false);
  assert.doesNotMatch(JSON.stringify(report), /private-event-id|must-never-surface/);
});

test("context blocker telemetry remains separate from pricing readiness and cannot change decision semantics", () => {
  const observations = [
    row(),
    row({ family: "odds", provider_key: "the-odds-api", mode: "live", ok: true, details: { source: "the-odds-api", mode: "live" } })
  ];
  const input = buildProviderReadinessInput({ snapshots: [], providerObservations: observations, incidents: [] });
  assert.equal(input.pricingProviderObservations.length, 1);
  assert.equal(input.contextProviderDiagnostics.summary.blockedFamilies.includes("injuries"), true);
  assert.equal(input.safety.thresholdsChanged, false);
  assert.equal(input.safety.multiProviderCoverageChanged, false);
  assert.equal(input.safety.missingEvidenceImputed, false);

  const applied = applyProviderReadinessTelemetry({ summary: {}, probability: 0.57, decision: "PLAY", stake: 10 }, input);
  assert.equal(applied.probability, 0.57);
  assert.equal(applied.decision, "PLAY");
  assert.equal(applied.stake, 10);
  assert.equal(applied.providerReadiness.semantics.contextProviderDiagnosticsAreTelemetryOnly, true);
  assert.equal(applied.providerReadiness.semantics.contextProviderBlockersCannotUpgradeEvidence, true);
});

test("Production Evidence renders context blockers without replacing existing pricing diagnosis", async () => {
  const client = await readFile(new URL("../app/production-evidence/ProviderDiagnosticsClient.jsx", import.meta.url), "utf8");
  const panel = await readFile(new URL("../app/production-evidence/ContextProviderDiagnosticsPanel.jsx", import.meta.url), "utf8");
  assert.match(client, /ProviderDiagnosticsPanel/);
  assert.match(client, /ContextProviderDiagnosticsPanel/);
  assert.match(client, /ProviderUsageLimitsPanel/);
  assert.match(panel, /providerReadiness\?\.contextProviderDiagnostics/);
  assert.match(panel, /Data blockers/);
  assert.match(panel, /subscriptionUnavailable/);
  assert.match(panel, /starterCounts/);
  assert.match(panel, /event IDs, team names, raw provider payloads or credentials/i);
});
