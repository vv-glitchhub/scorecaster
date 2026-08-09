import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const component = () => readFile(new URL("../app/production-evidence/ProviderDiagnosticsPanel.jsx", import.meta.url), "utf8");
const client = () => readFile(new URL("../app/production-evidence/ProductionEvidenceClient.jsx", import.meta.url), "utf8");

test("Production Evidence client renders the dedicated provider diagnosis panel", async () => {
  const source = await client();
  assert.match(source, /import ProviderDiagnosticsPanel from "\.\/ProviderDiagnosticsPanel"/);
  assert.match(source, /<ProviderDiagnosticsPanel data=\{data\} tr=\{tr\} \/>/);
});

test("provider diagnosis reads only aggregate provider-readiness structures", async () => {
  const source = await component();
  assert.match(source, /data\?\.providerReadiness/);
  assert.match(source, /secondaryPricingDiagnostics/);
  assert.match(source, /diagnostics\?\.providers/);
  assert.match(source, /diagnostics\?\.byLeague/);
  assert.match(source, /upstreamErrors/);
  assert.match(source, /matchDiagnostics/);
  assert.doesNotMatch(source, /event_id|eventId|homeTeam|awayTeam|home_team|away_team|providerHomeTeam|providerAwayTeam|rawProviderPayload|errorText|errorMessage/);
});

test("safe upstream categories are rendered as human-readable HTTP diagnosis labels", async () => {
  const source = await component();
  assert.match(source, /unauthorized:\s*"401 unauthorized"/);
  assert.match(source, /forbidden:\s*"403 forbidden"/);
  assert.match(source, /rate_limited:\s*"429 rate limited"/);
  assert.match(source, /provider_server_error:\s*"5xx provider error"/);
  assert.match(source, /provider_unavailable:\s*"503 unavailable"/);
  assert.match(source, /provider_timeout:\s*"504 \/ timeout"/);
});

test("diagnostics expose aggregate-only safety copy and accessible structure", async () => {
  const source = await component();
  assert.match(source, /Aggregate-only\./);
  assert.match(source, /aria-labelledby="pricing-provider-diagnostics-title"/);
  assert.match(source, /id="pricing-provider-diagnostics-title"/);
  assert.match(source, /<table/);
  assert.match(source, /<caption/);
  assert.match(source, /<th className=/);
  assert.match(source, /FI|fi:/i);
  assert.match(source, /en:/);
  assert.match(source, /es:/);
});

test("legacy or not-yet-populated evidence degrades to an explicit empty state", async () => {
  const source = await component();
  assert.match(source, /const diagnostics = readiness\?\.secondaryPricingDiagnostics \|\| null/);
  assert.match(source, /const providers = Array\.isArray\(diagnostics\?\.providers\) \? diagnostics\.providers : \[\]/);
  assert.match(source, /const leagues = Array\.isArray\(diagnostics\?\.byLeague\) \? diagnostics\.byLeague : \[\]/);
  assert.match(source, /No new provider diagnostics have been retained yet/);
});

test("UI makes pricing availability and all-provider availability visibly distinct", async () => {
  const source = await component();
  assert.match(source, /readiness\.averagePricingAvailability/);
  assert.match(source, /readiness\.averageAllProviderAvailability/);
  assert.match(source, /readiness\.pricingProviderCount/);
  assert.match(source, /readiness\.optionalProviderCount/);
});
