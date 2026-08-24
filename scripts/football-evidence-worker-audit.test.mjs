import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const routeUrl = new URL("../app/api/internal/sports-analytics/route.js", import.meta.url);

test("sports analytics worker stores immutable football evidence readiness with the shadow ledger", async () => {
  const source = await readFile(routeUrl, "utf8");
  assert.match(source, /version:\s*"sports-analytics-worker-v7"/);
  assert.match(source, /footballEvidenceAuditVersion:\s*"football-independent-evidence-v1"/);
  assert.match(source, /footballEvidenceReadiness/);
  assert.match(source, /evidenceAuditCapturedBeforeStart:\s*true/);
  assert.match(source, /evidenceAuditImmutableByCaptureBucket:\s*true/);
  assert.match(source, /evidenceAuditHistoricalReconstructionAllowed:\s*false/);
  assert.match(source, /historicalReconstructionAllowed:\s*false/);
});

test("worker stores only compact provider entitlement and lineage audit, never raw provider payload", async () => {
  const source = await readFile(routeUrl, "utf8");
  assert.match(source, /lineageHash/);
  assert.match(source, /commercialUseAllowed/);
  assert.match(source, /modelUseAllowed/);
  assert.match(source, /rawRedistributionAllowed/);
  assert.match(source, /rawProviderPayloadStoredInAuditSummary:\s*false/);
  assert.doesNotMatch(source, /rawFixture\s*:/);
  assert.doesNotMatch(source, /rawXgFixture\s*:/);
  assert.doesNotMatch(source, /providerPayload\s*:/);
});

test("worker preserves paper-only and production probability boundary", async () => {
  const source = await readFile(routeUrl, "utf8");
  assert.match(source, /productionProbabilityChanged:\s*false/);
  assert.match(source, /probabilityChanged:\s*false/);
  assert.match(source, /paperOnly:\s*true/);
});
