import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildClosingRecord,
  buildProviderObservations,
  buildUnifiedDataHistory,
  buildUnifiedDataSnapshot,
  evaluateUnifiedDataIncidents,
  summarizeProviderQuality,
  unifiedDataCaptureBucket
} from "../lib/unified-sports-data-v2.mjs";

const CAPTURED_AT = "2026-07-23T10:17:00.000Z";

function pick(overrides = {}) {
  return {
    gameId: "event-v2",
    match: "Home vs Away",
    homeTeam: "Home",
    awayTeam: "Away",
    selection: "Home",
    productDecision: "PLAY",
    sportKey: "soccer_epl",
    leagueTitle: "Premier League",
    commenceTime: "2026-07-23T18:00:00.000Z",
    odds: 2.1,
    consensusProbability: 0.48,
    unifiedDataProviders: {
      primaryOdds: { source: "the-odds-api", mode: "live", ok: true },
      secondaryOdds: { source: "sportsgameodds", mode: "live", ok: true },
      injuries: { source: "sportsdata", mode: "live", ok: true },
      lineups: { source: "lineup-provider", mode: "not_verified", ok: true }
    },
    unifiedSportsData: {
      eventId: "event-v2",
      selection: "Home",
      coverage: { coverageRate: 0.7, usedFamilies: 6, sourceCount: 8, independentOddsProviders: 2 },
      totalBoundedContextImpact: -0.01,
      safetyRecommendation: { action: "KEEP_CURRENT_DECISION" },
      missingData: [{ factor: "travel", missing: "verified travel data" }],
      sources: [
        { id: "primary", provider: "the-odds-api", trust: 0.82 },
        { id: "secondary", provider: "sportsgameodds", trust: 0.82 }
      ],
      factors: [
        {
          key: "odds-consensus",
          status: "verified-multi-provider",
          usedByAi: true,
          useMode: "market-probability",
          confidence: 0.8,
          trust: 0.86,
          impact: 0,
          direction: "neutral",
          downgradeEligible: false,
          evidence: [{ label: "providerDisagreement", value: 0.04 }]
        },
        {
          key: "travel",
          status: "missing",
          usedByAi: false,
          useMode: "risk",
          confidence: 0,
          trust: 0,
          impact: 0,
          direction: "neutral",
          downgradeEligible: false,
          evidence: []
        }
      ]
    },
    ...overrides
  };
}

test("capture buckets are deterministic thirty-minute windows", () => {
  assert.equal(unifiedDataCaptureBucket(CAPTURED_AT), "2026-07-23T10:00:00.000Z");
  assert.equal(unifiedDataCaptureBucket("2026-07-23T10:47:00.000Z"), "2026-07-23T10:30:00.000Z");
});

test("snapshot persists coverage, provenance and provider disagreement without changing probability", () => {
  const row = buildUnifiedDataSnapshot(pick(), { capturedAt: CAPTURED_AT });
  assert.equal(row.event_id, "event-v2");
  assert.equal(row.provider_count, 2);
  assert.equal(row.provider_disagreement, 0.04);
  assert.equal(row.coverage_score, 0.7);
  assert.equal(row.market_probability, 0.48);
  assert.equal(row.safety_action, "retain");
  assert.deepEqual(row.missing_families, ["travel"]);
  assert.equal(row.factor_statuses["odds-consensus"].usedByAi, true);
});

test("provider observations stay attributed to snapshot and provider family", () => {
  const rows = buildProviderObservations(pick(), "snapshot-1", { capturedAt: CAPTURED_AT });
  assert.equal(rows.length, 4);
  assert.ok(rows.some((row) => row.provider_key === "sportsgameodds" && row.family === "odds"));
  assert.ok(rows.some((row) => row.provider_key === "lineup-provider" && row.ok === false));
  assert.ok(rows.every((row) => row.snapshot_id === "snapshot-1"));
});

test("closing record uses only snapshots at or before start", () => {
  const rows = [
    { id: "opening", event_id: "event-v2", selection: "Home", sport_key: "soccer_epl", league: "Premier League", commence_time: "2026-07-23T18:00:00.000Z", odds: 2.2, captured_at: "2026-07-23T08:00:00.000Z" },
    { id: "closing", event_id: "event-v2", selection: "Home", sport_key: "soccer_epl", league: "Premier League", commence_time: "2026-07-23T18:00:00.000Z", odds: 2.0, captured_at: "2026-07-23T17:47:00.000Z" },
    { id: "post-start", event_id: "event-v2", selection: "Home", sport_key: "soccer_epl", league: "Premier League", commence_time: "2026-07-23T18:00:00.000Z", odds: 1.7, captured_at: "2026-07-23T18:10:00.000Z" }
  ];
  const record = buildClosingRecord(rows, { now: Date.parse("2026-07-23T19:00:00.000Z") });
  assert.equal(record.opening_odds, 2.2);
  assert.equal(record.closing_odds, 2.0);
  assert.equal(record.closing_snapshot_id, "closing");
  assert.equal(record.price_clv, 0.1);
});

test("provider quality and incidents identify persistent outages and divergence", () => {
  const observations = Array.from({ length: 6 }, (_, index) => ({ provider_key: "secondary", family: "odds", ok: index === 0, trust: 0.8, age_hours: 1, divergence_from_primary: 0.14 }));
  const quality = summarizeProviderQuality(observations);
  assert.equal(quality[0].status, "degraded");
  const incidents = evaluateUnifiedDataIncidents([{
    event_id: "event-v2",
    selection: "Home",
    provider_disagreement: 0.14,
    coverage_score: 0.3,
    total_context_impact: -0.04,
    safety_action: "downgrade",
    missing_families: ["lineups"]
  }], quality);
  assert.ok(incidents.some((item) => item.incidentType === "provider_divergence"));
  assert.ok(incidents.some((item) => item.incidentType === "low_data_coverage"));
  assert.ok(incidents.some((item) => item.incidentType === "adverse_verified_context"));
  assert.ok(incidents.some((item) => item.incidentType === "provider_health"));
});

test("history summarizes trends, closing records and active incidents", () => {
  const data = buildUnifiedDataHistory({
    snapshots: [
      { event_id: "event-v2", selection: "Home", captured_at: "2026-07-23T10:00:00.000Z", coverage_score: 0.5, provider_count: 1, total_context_impact: 0, safety_action: "retain", provider_disagreement: 0 },
      { event_id: "event-v2", selection: "Home", captured_at: "2026-07-23T10:30:00.000Z", coverage_score: 0.8, provider_count: 2, total_context_impact: -0.02, safety_action: "downgrade", provider_disagreement: 0.13 }
    ],
    observations: [{ provider_key: "primary", family: "odds", ok: true }],
    closingRecords: [{ event_id: "event-v2", selection: "Home", closing_odds: 2 }],
    incidents: [{ active: true }]
  });
  assert.equal(data.summary.snapshotCount, 2);
  assert.equal(data.summary.currentSelections, 1);
  assert.equal(data.summary.multiProviderSelections, 1);
  assert.equal(data.summary.closingRecordCount, 1);
  assert.equal(data.summary.activeIncidentCount, 1);
  assert.equal(data.trend.length, 2);
});

test("V2 ships storage, worker, scheduler, APIs and web/native history", async () => {
  const [sql, worker, workflow, api, health, web, eventAudit, mobile, manifest] = await Promise.all([
    readFile(new URL("../supabase/scorecaster_unified_data.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/api/internal/unified-data/route.js", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/unified-data-capture.yml", import.meta.url), "utf8"),
    readFile(new URL("../app/api/data-layer/history/route.js", import.meta.url), "utf8"),
    readFile(new URL("../app/api/data-layer/health/route.js", import.meta.url), "utf8"),
    readFile(new URL("../app/data-layer/UnifiedDataHistoryClient.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/event/[eventId]/EventDataAuditClient.jsx", import.meta.url), "utf8"),
    readFile(new URL("../mobile/src/screens/DataLayerScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../config/release-readiness.json", import.meta.url), "utf8")
  ]);
  assert.match(sql, /unified_data_snapshots/);
  assert.match(sql, /unified_data_closing_records/);
  assert.match(sql, /force row level security/);
  assert.match(worker, /buildClosingRecord/);
  assert.match(worker, /evaluateUnifiedDataIncidents/);
  assert.match(workflow, /cron: "17,47 \* \* \* \*"/);
  assert.match(api, /historyAvailable/);
  assert.match(health, /captureFresh/);
  assert.match(web, /Provider Quality/);
  assert.match(web, /Closing odds/);
  assert.match(eventAudit, /UnifiedDataHistoryClient/);
  assert.match(mobile, /UNIFIED SPORTS DATA V2/);
  assert.match(manifest, /scorecaster_unified_data\.sql/);
  assert.match(manifest, /\/api\/internal\/unified-data/);
});