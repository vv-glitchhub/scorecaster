import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  analyticsCaptureBucket,
  buildAutomaticObservationsFromPick,
  buildSportsAnalyticsSnapshot,
  canonicalSportFromKey,
  normalizeExternalAnalyticsPayload,
  summarizeSportsAnalyticsSnapshots,
  toSportsAnalyticsObservationRows
} from "../lib/sports-analytics-ingestion.mjs";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("sport keys normalize into the shared analytics catalogue", () => {
  assert.equal(canonicalSportFromKey("icehockey_nhl"), "ice_hockey");
  assert.equal(canonicalSportFromKey("soccer_epl"), "soccer");
  assert.equal(canonicalSportFromKey("basketball_nba"), "basketball");
  assert.equal(canonicalSportFromKey("golf_pga"), "golf");
  assert.equal(analyticsCaptureBucket("2026-07-26T10:44:00Z"), "2026-07-26T10:30:00.000Z");
});

test("existing Scorecaster data becomes automatic normalized observations", () => {
  const capturedAt = "2026-07-26T10:30:00Z";
  const rows = buildAutomaticObservationsFromPick({
    gameId: "game-1",
    sportKey: "icehockey_nhl",
    leagueTitle: "NHL",
    selection: "Home",
    odds: 2.15,
    marketProbability: 0.48,
    fairOdds: 2.08,
    edge: 0.03,
    ev: 0.032,
    bookmakerCount: 8,
    confidence: 0.72,
    sourceTrust: 0.8,
    trustScore: 81,
    unifiedSportsData: {
      coverage: { verifiedCoverageRate: 0.6, independentOddsProviders: 2 },
      factors: [{
        key: "odds-consensus",
        confidence: 0.8,
        trust: 0.85,
        impact: 0,
        sources: [{ provider: "the-odds-api", observedAt: capturedAt }],
        evidence: [{ selectedOdds: 2.15, primaryBookmakers: 8, independentOddsProviders: 2, providerDisagreement: 0.02 }]
      }]
    },
    sportsIntelligence: { injuries: [{ name: "A" }], lineups: [], news: [{ title: "N" }], conflicts: [] }
  }, { capturedAt });
  const metrics = new Set(rows.map((row) => row.metric));
  assert.ok(metrics.has("selected-odds"));
  assert.ok(metrics.has("market-probability"));
  assert.ok(metrics.has("edge"));
  assert.ok(metrics.has("provider-count"));
  assert.ok(metrics.has("provider-disagreement"));
  assert.ok(metrics.has("injury-record-count"));
  assert.ok(rows.every((row) => row.eventId === "game-1"));
  assert.ok(rows.every((row) => row.fingerprint.length === 64));
});

test("external payload accepts rich observations and golf shots without secrets", () => {
  const normalized = normalizeExternalAnalyticsPayload({
    provider: "licensed-feed",
    sourceTrust: 0.9,
    confidence: 0.85,
    observations: [
      { family: "expected", metric: "xg", value: 0.21, unit: "probability", metadata: { playId: "p1", apiKey: "must-not-survive" } },
      { family: "tracking", metric: "shot-speed", value: 151.2, unit: "km/h" }
    ],
    shots: [
      { id: "shot-1", player: "Player A", startDistanceMeters: 92, endDistanceMeters: 4.5, expectedEndDistanceMeters: 7.5, greenHit: true, club: "PW", lie: "fairway" }
    ]
  }, {
    sport: "golf",
    eventId: "golf-1",
    league: "PGA",
    capturedAt: "2026-07-26T10:30:00Z",
    observedAt: "2026-07-26T10:25:00Z"
  });
  assert.equal(normalized.provider, "licensed-feed");
  assert.equal(normalized.golfShots.length, 1);
  assert.ok(normalized.observations.some((row) => row.metric === "xg"));
  assert.ok(normalized.observations.some((row) => row.metric === "expected-proximity"));
  const xg = normalized.observations.find((row) => row.metric === "xg");
  assert.equal(xg.metadata.apiKey, undefined);
});

test("snapshot builds visual coverage, providers and golf profile", () => {
  const capturedAt = "2026-07-26T10:30:00Z";
  const external = normalizeExternalAnalyticsPayload({
    provider: "golf-feed",
    observations: [
      { family: "expected", metric: "expected-proximity", value: 7.5, unit: "m" },
      { family: "expected", metric: "proximity-gained", value: 3, unit: "m" }
    ],
    shots: [
      { id: "shot-1", startDistanceMeters: 92, endDistanceMeters: 4.5, expectedEndDistanceMeters: 7.5, greenHit: true },
      { id: "shot-2", startDistanceMeters: 88, endDistanceMeters: 7.5, expectedEndDistanceMeters: 7.5, greenHit: true }
    ]
  }, { sport: "golf", eventId: "golf-1", capturedAt, observedAt: capturedAt });
  const snapshot = buildSportsAnalyticsSnapshot({
    pick: { gameId: "golf-1", sportKey: "golf_pga", leagueTitle: "PGA", match: "Tournament" },
    observations: external.observations,
    golfShots: external.golfShots,
    providerStatus: { external: { source: "golf-feed", mode: "live", ok: true } },
    capturedAt
  });
  assert.equal(snapshot.canonical_sport, "golf");
  assert.equal(snapshot.golf_profile[0].bucket, "75-100 m");
  assert.equal(snapshot.golf_profile[0].samples, 2);
  assert.ok(snapshot.coverage_score > 0);
  const rows = toSportsAnalyticsObservationRows("snapshot-1", snapshot, external.observations);
  assert.ok(rows.every((row) => row.paper_only === true));
  assert.ok(rows.every((row) => row.snapshot_id === "snapshot-1"));
  const summary = summarizeSportsAnalyticsSnapshots([snapshot]);
  assert.equal(summary.eventCount, 1);
  assert.equal(summary.sports[0].sport, "golf");
});

test("worker, API, page and schedule preserve automatic paper-only boundaries", async () => {
  const [worker, api, client, workflow, migration, provider] = await Promise.all([
    source("app/api/internal/sports-analytics/route.js"),
    source("app/api/sports-analytics/route.js"),
    source("app/sports-analytics/SportsAnalyticsClient.jsx"),
    source(".github/workflows/unified-data-capture.yml"),
    source("supabase/scorecaster_sports_analytics.sql"),
    source("lib/sports-analytics-provider.js")
  ]);
  assert.match(worker, /CRON_SECRET/);
  assert.match(worker, /fetchExternalSportsAnalytics/);
  assert.match(worker, /probabilityChanged: false/);
  assert.match(worker, /paperOnly: true/);
  assert.match(api, /liveFallback/);
  assert.match(api, /analyticsCanUpgradeDecision: false/);
  assert.match(client, /GolfProfile/);
  assert.match(client, /Dataperheiden kattavuus/);
  assert.match(workflow, /\/api\/internal\/sports-analytics/);
  assert.match(workflow, /cron: "17,47 \* \* \* \*"/);
  assert.match(migration, /sports_analytics_snapshots/);
  assert.match(migration, /sports_analytics_observations/);
  assert.match(migration, /force row level security/);
  assert.match(provider, /Authorization = `Bearer \$\{apiKey\}`/);
  assert.doesNotMatch(client, /SPORTS_ANALYTICS_API_KEY|CRON_SECRET|SUPABASE_SERVICE_ROLE_KEY/);
});
