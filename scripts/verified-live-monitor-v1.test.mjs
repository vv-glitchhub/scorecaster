import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildVerifiedLiveMonitor, VERIFIED_LIVE_MONITOR_VERSION } from "../lib/verified-live-monitor-v1.mjs";
import { normalizeLiveMonitorBatch, liveMonitorProviderConfiguration } from "../lib/live-monitor-json-provider.js";

const generatedAt = "2026-08-06T12:00:00.000Z";
const eventId = "verified-event-1";
const at = (secondsBefore) => new Date(Date.parse(generatedAt) - secondsBefore * 1000).toISOString();

function snapshot(overrides = {}) {
  return {
    id: overrides.id || `row-${overrides.provider_id || overrides.providerId || "provider-a"}-${overrides.observed_at || overrides.observedAt || at(30)}`,
    event_id: eventId,
    sport: "soccer_epl",
    league: "Premier League",
    market: "h2h",
    provider_id: "provider-a",
    source_id: "licensed_live",
    status: "live",
    period: 1,
    clock_seconds: 1800,
    clock_direction: "up",
    home_team: "Home",
    away_team: "Away",
    home_score: 1,
    away_score: 0,
    commence_time: at(3600),
    observed_at: at(30),
    provider_updated_at: at(30),
    captured_at: at(29),
    correction: false,
    correction_reason: null,
    supersedes_id: null,
    metrics: {},
    prices: [],
    live_probabilities: { home: 0.6, draw: 0.25, away: 0.15 },
    live_model_version: "licensed-live-v1",
    ...overrides
  };
}

function monitor(rows, configuration = {}) {
  return buildVerifiedLiveMonitor({ eventId, generatedAt, snapshots: rows }, configuration);
}

test("two fresh agreeing providers produce a verified current state", () => {
  const rows = [
    snapshot({ id: "p1", provider_id: "provider-a", observed_at: at(25), provider_updated_at: at(25), captured_at: at(24) }),
    snapshot({ id: "p2", provider_id: "provider-b", observed_at: at(20), provider_updated_at: at(20), captured_at: at(19) })
  ];
  const result = monitor(rows);
  assert.equal(result.ok, true);
  assert.equal(result.version, VERIFIED_LIVE_MONITOR_VERSION);
  assert.equal(result.suspended, false);
  assert.equal(result.status, "live");
  assert.equal(result.current.homeScore, 1);
  assert.equal(result.current.awayScore, 0);
  assert.equal(result.integrity.freshProviderCount, 2);
  assert.equal(result.current.providerCount, 2);
  assert.equal(result.boundaries.preMatchAuditChanged, false);
  assert.equal(result.boundaries.preMatchModelFeaturesChanged, false);
  assert.equal(result.boundaries.stakeSuggested, false);
  assert.equal(result.boundaries.realMoneyExecution, false);
});

test("the engine is deterministic for the same evidence cutoff", () => {
  const rows = [
    snapshot({ id: "det-a", provider_id: "provider-a", observed_at: at(25), provider_updated_at: at(25), captured_at: at(24) }),
    snapshot({ id: "det-b", provider_id: "provider-b", observed_at: at(20), provider_updated_at: at(20), captured_at: at(19) })
  ];
  assert.deepEqual(monitor(rows), monitor(rows));
});

test("material provider disagreement suspends live interpretation", () => {
  const rows = [
    snapshot({ id: "conflict-a", provider_id: "provider-a", home_score: 1, away_score: 0, observed_at: at(20), provider_updated_at: at(20), captured_at: at(19) }),
    snapshot({ id: "conflict-b", provider_id: "provider-b", home_score: 0, away_score: 1, observed_at: at(18), provider_updated_at: at(18), captured_at: at(17) })
  ];
  const result = monitor(rows);
  assert.equal(result.suspended, true);
  assert.equal(result.current, null);
  assert.equal(result.suspensionReason, "provider-state-conflict");
  const alert = result.alerts.find((item) => item.id === "provider-conflict");
  assert.ok(alert);
  assert.equal(alert.severity, "high");
  assert.equal(alert.actionMode, "informational-paper-only");
});

test("stale provider evidence cannot create a confident current state", () => {
  const result = monitor([
    snapshot({ id: "stale-a", observed_at: at(400), provider_updated_at: at(400), captured_at: at(399) })
  ]);
  assert.equal(result.suspended, true);
  assert.equal(result.current, null);
  assert.equal(result.integrity.freshProviderCount, 0);
  assert.ok(result.alerts.some((item) => item.id === "provider-stale"));
  assert.equal(result.liveProbability, null);
});

test("a backward score or clock update is rejected without a correction", () => {
  const rows = [
    snapshot({ id: "regression-old", observed_at: at(60), provider_updated_at: at(60), captured_at: at(59), home_score: 1, clock_seconds: 1500 }),
    snapshot({ id: "regression-new", observed_at: at(20), provider_updated_at: at(20), captured_at: at(19), home_score: 0, clock_seconds: 1200 })
  ];
  const result = monitor(rows);
  assert.equal(result.integrity.regressions.length, 1);
  assert.equal(result.integrity.regressions[0].snapshotId, "regression-new");
  assert.equal(result.current.homeScore, 1);
  assert.ok(result.alerts.some((item) => item.id === "invalid-regression"));
});

test("a visible correction preserves both original and corrected evidence", () => {
  const rows = [
    snapshot({ id: "original-score", observed_at: at(60), provider_updated_at: at(60), captured_at: at(59), home_score: 1, clock_seconds: 1500 }),
    snapshot({
      id: "corrected-score",
      observed_at: at(20),
      provider_updated_at: at(20),
      captured_at: at(19),
      home_score: 0,
      clock_seconds: 1500,
      correction: true,
      correction_reason: "Provider removed a duplicated goal event",
      supersedes_id: "original-score"
    })
  ];
  const result = monitor(rows);
  assert.equal(result.timeline.some((row) => row.id === "original-score"), true);
  assert.equal(result.timeline.some((row) => row.id === "corrected-score" && row.correction), true);
  assert.equal(result.integrity.corrections.length, 1);
  assert.equal(result.integrity.supersededRowsRetainedInAudit, true);
  assert.equal(result.boundaries.historyRewritten, false);
  assert.equal(result.boundaries.appendOnlyCorrectionAudit, true);
  assert.ok(result.alerts.some((item) => item.id === "visible-correction"));
});

test("fresh multi-provider live probability movement remains separate from pre-match", () => {
  const rows = [
    snapshot({ id: "move-a-old", provider_id: "provider-a", observed_at: at(75), provider_updated_at: at(75), captured_at: at(74), home_score: 0, clock_seconds: 1200, live_probabilities: { home: 0.45, draw: 0.3, away: 0.25 } }),
    snapshot({ id: "move-b-old", provider_id: "provider-b", observed_at: at(70), provider_updated_at: at(70), captured_at: at(69), home_score: 0, clock_seconds: 1200, live_probabilities: { home: 0.46, draw: 0.29, away: 0.25 } }),
    snapshot({ id: "move-a-new", provider_id: "provider-a", observed_at: at(25), provider_updated_at: at(25), captured_at: at(24), home_score: 1, clock_seconds: 1500, live_probabilities: { home: 0.62, draw: 0.23, away: 0.15 } }),
    snapshot({ id: "move-b-new", provider_id: "provider-b", observed_at: at(20), provider_updated_at: at(20), captured_at: at(19), home_score: 1, clock_seconds: 1500, live_probabilities: { home: 0.64, draw: 0.22, away: 0.14 } })
  ];
  const result = monitor(rows);
  assert.equal(result.suspended, false);
  assert.ok(result.liveProbability);
  assert.equal(result.liveProbability.separatedFromPreMatchAudit, true);
  assert.equal(result.liveProbability.usableForPreMatchFeatures, false);
  assert.equal(result.liveProbability.modelVersion, "live-provider-consensus-v1");
  assert.ok(result.alerts.some((item) => item.id === "live-probability-move"));
});

test("unsupported and future evidence is rejected and excluded from append-only public timeline", () => {
  const result = monitor([
    snapshot({ id: "unsupported-sport", sport: "tennis_atp" }),
    snapshot({ id: "unsupported-market", market: "player_props" }),
    snapshot({ id: "future-row", observed_at: "2026-08-06T12:10:00.000Z", provider_updated_at: "2026-08-06T12:10:00.000Z", captured_at: "2026-08-06T12:10:01.000Z" })
  ]);
  assert.equal(result.rejected.length, 3);
  assert.equal(result.timeline.length, 0);
  assert.equal(result.suspended, true);
});

test("live alert output contains no stake, deposit or entry instruction", () => {
  const result = monitor([
    snapshot({ id: "safe-alert-a", provider_id: "provider-a", home_score: 1, away_score: 0, observed_at: at(20), provider_updated_at: at(20), captured_at: at(19) }),
    snapshot({ id: "safe-alert-b", provider_id: "provider-b", home_score: 0, away_score: 1, observed_at: at(18), provider_updated_at: at(18), captured_at: at(17) })
  ]);
  const serialized = JSON.stringify(result.alerts).toLowerCase();
  for (const phrase of ["bet now", "enter now", "suggested stake", "deposit", "withdraw", "guaranteed profit", "guaranteed win"]) {
    assert.equal(serialized.includes(phrase), false, `Forbidden live alert phrase found: ${phrase}`);
  }
  assert.equal(result.alerts.every((item) => item.realMoneyInstruction === false && item.realMoneyExecution === false), true);
});

test("rights-gated provider normalization rejects unknown events and accepts licensed HTTPS evidence", () => {
  const env = {
    NODE_ENV: "production",
    COLLECTOR_JSON_API_URL: "https://licensed.example/live",
    COLLECTOR_JSON_SOURCE_ID: "licensed_live",
    COLLECTOR_JSON_ENABLED: "true",
    COLLECTOR_JSON_ACCESS_MODE: "production",
    COLLECTOR_JSON_COMMERCIAL_ALLOWED: "true",
    COLLECTOR_JSON_LICENSE: "verified-commercial-contract",
    LIVE_MONITOR_SOURCE_ID: "licensed_live",
    LIVE_MONITOR_ENABLED: "true",
    LIVE_MONITOR_AUTH_MODE: "ip_allowlist",
    LIVE_MONITOR_LIVE_DATA_ALLOWED: "true",
    LIVE_MONITOR_DISPLAY_ALLOWED: "true",
    LIVE_MONITOR_CONTRACT_REFERENCE: "contract-on-file",
    LIVE_MONITOR_RETENTION_DAYS: "30"
  };
  const events = [{ eventId, sport: "soccer_epl", league: "Premier League", homeTeam: "Home", awayTeam: "Away", commenceTime: at(3600) }];
  const configuration = liveMonitorProviderConfiguration(env);
  assert.equal(configuration.enabled, true);
  assert.equal(configuration.productionAllowed, true);
  assert.equal(configuration.contractReady, true);
  assert.deepEqual(configuration.failedGates, []);
  assert.equal(configuration.baseUrl, "configured");
  assert.equal(configuration.rawPayloadStored, false);

  const normalized = normalizeLiveMonitorBatch([
    {
      providerReference: "record-1",
      eventId,
      sourceId: "licensed_live",
      providerId: "licensed-provider",
      sport: "soccer_epl",
      market: "h2h",
      status: "live",
      period: 1,
      clockSeconds: 600,
      clockDirection: "up",
      homeScore: 0,
      awayScore: 0,
      observedAt: at(20),
      providerUpdatedAt: at(20),
      capturedAt: at(19)
    },
    {
      providerReference: "unknown-event-record",
      eventId: "not-requested",
      sourceId: "licensed_live",
      providerId: "licensed-provider",
      sport: "soccer_epl",
      market: "h2h",
      status: "live",
      homeScore: 0,
      awayScore: 0,
      observedAt: at(20)
    }
  ], { env, sourceId: "licensed_live", events, collectedAt: generatedAt });
  assert.equal(normalized.received, 2);
  assert.equal(normalized.accepted.length, 1);
  assert.equal(normalized.rejected.length, 1);
  assert.ok(normalized.rejected[0].errors.includes("unknown-event"));
});

test("live provider remains fail-closed when explicit live display rights are missing", () => {
  const configuration = liveMonitorProviderConfiguration({
    NODE_ENV: "production",
    COLLECTOR_JSON_API_URL: "https://licensed.example/live",
    COLLECTOR_JSON_SOURCE_ID: "licensed_live",
    COLLECTOR_JSON_ENABLED: "true",
    COLLECTOR_JSON_ACCESS_MODE: "production",
    COLLECTOR_JSON_COMMERCIAL_ALLOWED: "true",
    LIVE_MONITOR_SOURCE_ID: "licensed_live",
    LIVE_MONITOR_ENABLED: "true",
    LIVE_MONITOR_AUTH_MODE: "ip_allowlist",
    LIVE_MONITOR_CONTRACT_REFERENCE: "contract-on-file",
    LIVE_MONITOR_RETENTION_DAYS: "30"
  });
  assert.equal(configuration.contractReady, false);
  assert.equal(configuration.productionAllowed, false);
  assert.ok(configuration.failedGates.includes("liveDataAllowed"));
  assert.ok(configuration.failedGates.includes("displayAllowed"));
});

test("storage patch enforces service-only evidence and own-user alerts", async () => {
  const sql = await readFile(new URL("./apply-verified-live-monitor-v1.sql", import.meta.url), "utf8");
  const verify = await readFile(new URL("./verify-verified-live-monitor-v1.sql", import.meta.url), "utf8");
  assert.match(sql, /alter table public\.live_event_snapshots_v1 enable row level security/i);
  assert.match(sql, /alter table public\.live_event_snapshots_v1 force row level security/i);
  assert.match(sql, /alter table public\.live_monitor_alerts_v1 enable row level security/i);
  assert.match(sql, /using \(auth\.uid\(\) = user_id\)/i);
  assert.match(sql, /revoke all privileges on table public\.live_event_snapshots_v1 from public, anon, authenticated/i);
  assert.match(sql, /revoke all privileges on table public\.live_monitor_alerts_v1 from public, anon, authenticated/i);
  assert.match(sql, /grant select, update, delete on table public\.live_monitor_alerts_v1 to authenticated/i);
  assert.doesNotMatch(sql, /grant\s+insert[^;]*live_monitor_alerts_v1[^;]*authenticated/i);
  assert.match(verify, /evidenceServiceOnly/i);
  assert.match(verify, /alertsServerWriteOnly/i);
  assert.doesNotMatch(sql, /\b(drop table|truncate table|delete from)\b/i);
});

test("worker, APIs, UI, account lifecycle and retired live endpoint preserve safety boundary", async () => {
  const worker = await readFile(new URL("../app/api/internal/verified-live-monitor/route.js", import.meta.url), "utf8");
  const publicApi = await readFile(new URL("../app/api/verified-live-monitor/route.js", import.meta.url), "utf8");
  const cloudApi = await readFile(new URL("../app/api/cloud/verified-live-monitor/route.js", import.meta.url), "utf8");
  const health = await readFile(new URL("../app/api/verified-live-monitor/health/route.js", import.meta.url), "utf8");
  const retired = await readFile(new URL("../app/api/live-betting/route.js", import.meta.url), "utf8");
  const eventPage = await readFile(new URL("../app/event/[eventId]/page.jsx", import.meta.url), "utf8");
  const eventPanel = await readFile(new URL("../app/event/[eventId]/EventVerifiedLiveMonitorPanel.jsx", import.meta.url), "utf8");
  const directPage = await readFile(new URL("../app/live-monitor/[eventId]/page.jsx", import.meta.url), "utf8");
  const dashboard = await readFile(new URL("../app/live-monitor/VerifiedLiveMonitorClient.jsx", import.meta.url), "utf8");
  const navigation = await readFile(new URL("../app/components/AppShell.jsx", import.meta.url), "utf8");
  const accountExport = await readFile(new URL("../app/api/account/export/route.js", import.meta.url), "utf8");
  const accountDelete = await readFile(new URL("../app/api/account/route.js", import.meta.url), "utf8");
  const provider = await readFile(new URL("../lib/live-monitor-json-provider.js", import.meta.url), "utf8");
  const docs = await readFile(new URL("../docs/VERIFIED_LIVE_MONITOR_V1.md", import.meta.url), "utf8");

  assert.match(worker, /CRON_SECRET/);
  assert.match(worker, /max_alerts_per_hour/);
  assert.match(worker, /quietPeriodTimezone: "UTC"/);
  assert.match(worker, /rawPayloadStored: false/);
  assert.match(worker, /stakeSuggested: false/);
  assert.match(publicApi, /userDataReturned: false/);
  assert.match(publicApi, /apiKeysReturned: false/);
  assert.match(cloudApi, /getAuthenticatedContext/);
  assert.match(cloudApi, /\.eq\("user_id", auth\.user\.id\)/);
  assert.match(cloudApi, /mutationOriginAllowed/);
  assert.match(health, /userIdentifiersReturned: false/);
  assert.match(health, /alertEvidenceReturned: false/);
  assert.doesNotMatch(retired, /live-betting-engine/);
  assert.match(retired, /suggestedStake: null/);
  assert.match(retired, /entryInstruction: false/);
  assert.match(eventPage, /EventVerifiedLiveMonitorPanel/);
  assert.match(eventPanel, /\/live-monitor\/\$\{encodeURIComponent\(eventId\)\}/);
  assert.match(directPage, /VerifiedLiveEventClient/);
  assert.match(dashboard, /stakeSuggested=false/);
  assert.match(navigation, /href: "\/live-monitor"/);
  assert.match(accountExport, /live_monitor_preferences_v1/);
  assert.match(accountExport, /live_monitor_alerts_v1/);
  assert.match(accountExport, /liveMonitorPreferences/);
  assert.match(accountExport, /liveMonitorAlerts/);
  assert.match(accountDelete, /"live_monitor_alerts_v1"[\s\S]*"live_monitor_preferences_v1"/);
  assert.match(provider, /https-required/);
  assert.match(provider, /rawPayloadStored: false/);
  assert.match(docs, /quiet-period times are interpreted in \*\*UTC\*\*/i);
  assert.match(docs, /does not place bets/i);
  assert.match(docs, /legacy `\/api\/live-betting` endpoint is retired/i);
});
