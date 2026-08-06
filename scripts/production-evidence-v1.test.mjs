import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildProductionEvidence,
  buildProviderEvidence,
  PRODUCTION_EVIDENCE_VERSION
} from "../lib/production-evidence-v1.mjs";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const NOW = Date.parse("2026-08-06T04:00:00.000Z");

function healthyFixture({ invalidClosingFrom = Infinity, duplicateSnapshots = false } = {}) {
  const snapshots = [];
  const providerObservations = [];
  const closingRecords = [];
  for (let index = 0; index < 20; index += 1) {
    const eventId = `event-${index + 1}`;
    const commence = new Date(NOW - (index + 1) * 60000).toISOString();
    const snapshot = {
      event_id: eventId,
      sport_key: "soccer_epl",
      league: "epl",
      commence_time: commence,
      home_team: `Home ${index + 1}`,
      away_team: `Away ${index + 1}`,
      provider_count: 2,
      provider_disagreement: 0.03,
      coverage_score: 0.92,
      captured_at: new Date(NOW - 10 * 60000).toISOString()
    };
    if (duplicateSnapshots) snapshots.push({ ...snapshot, provider_count: 1, coverage_score: 0.4, captured_at: new Date(NOW - 60 * 60000).toISOString() });
    snapshots.push(snapshot);
    for (const provider of ["odds-primary", "odds-secondary"]) {
      providerObservations.push({
        event_id: eventId,
        provider_key: provider,
        family: "odds",
        ok: true,
        trust: 0.94,
        confidence: 0.91,
        observed_at: new Date(NOW - 8 * 60000).toISOString(),
        captured_at: new Date(NOW - 7 * 60000).toISOString()
      });
    }
    closingRecords.push({
      event_id: eventId,
      selection: "home",
      sport_key: "soccer_epl",
      league: "epl",
      commence_time: commence,
      closing_odds: 2.05,
      closing_captured_at: new Date(Date.parse(commence) + (index >= invalidClosingFrom ? 60000 : -60000)).toISOString()
    });
  }
  const collectorRuns = Array.from({ length: 20 }, (_, index) => ({
    status: "success",
    started_at: new Date(NOW - (index + 1) * 60000).toISOString(),
    completed_at: new Date(NOW - index * 60000).toISOString(),
    accepted_count: 100,
    rejected_count: 0,
    publishable_count: 100
  }));
  return {
    snapshots,
    providerObservations,
    closingRecords,
    collectorRuns,
    incidents: [],
    now: NOW,
    windowDays: 30,
    dataAvailability: {
      snapshots: true,
      providerObservations: true,
      closingRecords: true,
      incidents: true,
      collectorRuns: true
    }
  };
}

test("healthy evidence enables a league only after every denominator passes", () => {
  const report = buildProductionEvidence(healthyFixture());
  assert.equal(report.version, PRODUCTION_EVIDENCE_VERSION);
  assert.equal(report.releaseState, "ready");
  assert.equal(report.ready, true);
  assert.equal(report.leagues.length, 1);
  assert.equal(report.leagues[0].state, "enabled");
  assert.equal(report.leagues[0].events, 20);
  assert.equal(report.leagues[0].verifiedIdentityRate, 1);
  assert.equal(report.leagues[0].multiProviderRate, 1);
  assert.equal(report.leagues[0].closingLineCoverage, 1);
  assert.deepEqual(report.leagues[0].denominators, { identity: 20, multiProvider: 20, closingLine: 20 });
  assert.equal(report.worker.successRate, 1);
  assert.equal(report.providers.length, 2);
});

test("latest snapshot per event prevents repeated captures from inflating league evidence", () => {
  const report = buildProductionEvidence(healthyFixture({ duplicateSnapshots: true }));
  assert.equal(report.summary.events, 20);
  assert.equal(report.leagues[0].events, 20);
  assert.equal(report.leagues[0].multiProviderRate, 1);
  assert.equal(report.leagues[0].averageCoverageScore, 0.92);
});

test("post-start closing observations are rejected without a fallback or imputation", () => {
  const report = buildProductionEvidence(healthyFixture({ invalidClosingFrom: 10 }));
  assert.equal(report.releaseState, "blocked");
  assert.equal(report.leagues[0].state, "degraded");
  assert.equal(report.leagues[0].closingEvents, 10);
  assert.equal(report.leagues[0].closingLineCoverage, 0.5);
  assert.ok(report.leagues[0].reasons.includes("closing-line-coverage-below-target"));
  assert.equal(report.safety.closingLineUsedForPregameDecision, false);
});

test("missing evidence disables readiness instead of inventing healthy values", () => {
  const fixture = healthyFixture();
  fixture.snapshots = fixture.snapshots.slice(0, 4);
  fixture.providerObservations = [];
  fixture.closingRecords = [];
  fixture.collectorRuns = [];
  fixture.dataAvailability.providerObservations = false;
  fixture.dataAvailability.closingRecords = false;
  const report = buildProductionEvidence(fixture);
  assert.equal(report.releaseState, "blocked");
  assert.equal(report.leagues[0].state, "disabled");
  assert.ok(report.blockers.includes("protected-worker-disabled"));
  assert.ok(report.blockers.includes("provider-evidence-missing"));
  assert.equal(report.summary.closingLineCoverage, 0);
  assert.equal(report.summary.averageProviderAvailability, null);
  assert.equal(report.safety.probabilityChanged, false);
  assert.equal(report.safety.realMoneyExecution, false);
});

test("provider evidence uses the latest event-provider-family row", () => {
  const providers = buildProviderEvidence([
    { event_id: "one", provider_key: "source-a", family: "odds", ok: false, trust: 0.2, observed_at: "2026-08-06T02:00:00.000Z" },
    { event_id: "one", provider_key: "source-a", family: "odds", ok: true, trust: 0.9, confidence: 0.9, observed_at: "2026-08-06T03:55:00.000Z" }
  ], { now: NOW });
  assert.equal(providers.length, 1);
  assert.equal(providers[0].observations, 1);
  assert.equal(providers[0].availabilityRate, 1);
  assert.equal(providers[0].state, "enabled");
});

test("an in-flight collector run is visible but excluded from the completed-cycle denominator", () => {
  const fixture = healthyFixture();
  fixture.collectorRuns.unshift({ status: "running", started_at: new Date(NOW - 30000).toISOString() });
  const report = buildProductionEvidence(fixture);
  assert.equal(report.worker.observedCycles, 21);
  assert.equal(report.worker.cycles, 20);
  assert.equal(report.worker.inFlight, 1);
  assert.equal(report.worker.denominator, 20);
  assert.equal(report.worker.successRate, 1);
});

test("public API, UI, workflow and documentation preserve the audited paper-only boundary", async () => {
  const [api, client, shell, workflow, docs, manifest, packageJson] = await Promise.all([
    source("app/api/production-evidence/route.js"),
    source("app/production-evidence/ProductionEvidenceClient.jsx"),
    source("app/components/AppShell.jsx"),
    source(".github/workflows/production-evidence-v1.yml"),
    source("docs/PRODUCTION_EVIDENCE_V1.md"),
    source("config/release-readiness.json"),
    source("package.json")
  ]);
  assert.match(api, /unified_data_snapshots/);
  assert.match(api, /unified_data_provider_observations/);
  assert.match(api, /unified_data_closing_records/);
  assert.match(api, /format === "csv"/);
  assert.doesNotMatch(api, /select\([^)]*payload|user_id|api_key|access_token/i);
  assert.match(client, /visible denominators|Näkyvät nimittäjät/);
  assert.match(client, /Paper-only safety/);
  assert.match(client, /fi:/);
  assert.match(client, /en:/);
  assert.match(client, /es:/);
  assert.match(shell, /href: "\/production-evidence"/);
  assert.match(workflow, /scripts\/production-evidence-v1\.test\.mjs/);
  assert.match(workflow, /npm run build/);
  assert.match(docs, /no bookmaker credentials/i);
  assert.match(docs, /closing-line denominator/i);
  assert.match(manifest, /"\/production-evidence"/);
  assert.match(packageJson, /test:production-evidence/);
  for (const text of [api, client]) {
    assert.doesNotMatch(text, /placeBet|deposit|withdraw|bookmakerPassword/i);
  }
});
