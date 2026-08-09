import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("provider diagnostics are additive and preserve the existing fail-closed numeric guard", async () => {
  const page = await source("app/production-evidence/page.jsx");
  const existingClient = await source("app/production-evidence/ProductionEvidenceClient.jsx");
  assert.match(page, /<ProductionEvidenceClient \/>/);
  assert.match(page, /<ProviderDiagnosticsClient \/>/);
  assert.match(existingClient, /const presentNumber = \(value\) => value !== null && value !== undefined && value !== ""/);
  assert.match(existingClient, /presentNumber\(value\) \? .* : "—"/);
});

test("diagnostics read only release-safe provider readiness aggregates", async () => {
  const client = await source("app/production-evidence/ProviderDiagnosticsClient.jsx");
  const panel = await source("app/production-evidence/ProviderDiagnosticsPanel.jsx");
  assert.match(client, /\/api\/production-evidence\?/);
  assert.match(panel, /data\?\.providerReadiness/);
  assert.match(panel, /secondaryPricingDiagnostics/);
  assert.match(panel, /averagePricingAvailability/);
  assert.match(panel, /averageAllProviderAvailability/);
  assert.match(panel, /modeCounts/);
  assert.match(panel, /upstreamErrors/);
  assert.match(panel, /matchDiagnostics/);
});

test("safe SportsGameOdds usage UI renders only binding labels and aggregate ratios", async () => {
  const panel = await source("app/production-evidence/ProviderDiagnosticsPanel.jsx");
  assert.match(panel, /bindingLimits/);
  assert.match(panel, /maximumObservedRequestRatio/);
  assert.match(panel, /maximumObservedEntityRatio/);
  assert.match(panel, /per-second/);
  assert.match(panel, /per-minute/);
  assert.match(panel, /per-hour/);
  assert.match(panel, /per-day/);
  assert.match(panel, /per-month/);
  assert.match(panel, /Repeated event rows are not independent account-usage samples/);
  for (const forbidden of [
    /currentRequests/,
    /maxRequests/,
    /currentEntities/,
    /maxEntities/,
    /keyID/,
    /customerID/,
    /SPORTSGAMEODDS_API_KEY/,
    /x-api-key/i
  ]) assert.doesNotMatch(panel, forbidden);
});

test("diagnostics never depend on event identifiers, team names, raw payloads or error bodies", async () => {
  const combined = `${await source("app/production-evidence/ProviderDiagnosticsClient.jsx")}\n${await source("app/production-evidence/ProviderDiagnosticsPanel.jsx")}`;
  for (const forbidden of [
    /event_id/i,
    /eventId/,
    /homeTeam/,
    /awayTeam/,
    /teamName/,
    /rawPayload/,
    /providerPayload/,
    /errorBody/,
    /errorMessage/,
    /x-api-key/i,
    /SPORTSGAMEODDS_API_KEY/
  ]) assert.doesNotMatch(combined, forbidden);
});

test("safe upstream categories are rendered with explicit HTTP labels", async () => {
  const panel = await source("app/production-evidence/ProviderDiagnosticsPanel.jsx");
  for (const label of ["400 bad request", "401 unauthorized", "403 forbidden", "429 rate limited", "5xx provider error", "503 unavailable", "504 / timeout"]) {
    assert.match(panel, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("legacy evidence degrades gracefully instead of inventing provider health", async () => {
  const panel = await source("app/production-evidence/ProviderDiagnosticsPanel.jsx");
  assert.match(panel, /const diagnostics = readiness\?\.secondaryPricingDiagnostics \|\| null/);
  assert.match(panel, /const hasEvidence = Boolean/);
  assert.match(panel, /No new provider diagnostics have been retained yet/);
  assert.match(panel, /No usage evidence yet/);
  assert.match(panel, /presentNumber\(value\) \? .* : "—"/);
});

test("provider diagnosis remains read-only and paper-analysis adjacent", async () => {
  const combined = `${await source("app/production-evidence/ProviderDiagnosticsClient.jsx")}\n${await source("app/production-evidence/ProviderDiagnosticsPanel.jsx")}`;
  assert.doesNotMatch(combined, /method:\s*["']POST["']/);
  assert.doesNotMatch(combined, /method:\s*["']PUT["']/);
  assert.doesNotMatch(combined, /method:\s*["']DELETE["']/);
  assert.doesNotMatch(combined, /placeBet|submitBet|bookmakerLogin|payment/i);
  assert.match(combined, /Aggregate-only/);
});
