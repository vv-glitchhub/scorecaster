import { getSupabaseAdmin } from "../../../lib/supabase-admin";
import { sportsAnalyticsProviderConfiguration } from "../../../lib/sports-analytics-provider";
import {
  buildAutomaticObservationsFromPick,
  buildSportsAnalyticsSnapshot,
  canonicalSportFromKey,
  summarizeSportsAnalyticsSnapshots
} from "../../../lib/sports-analytics-ingestion.mjs";
import { buildSportsAnalyticsInsights } from "../../../lib/sports-analytics-insights.mjs";
import { buildSportsAnalyticsActivationPlan } from "../../../lib/sports-analytics-activation.mjs";

export const dynamic = "force-dynamic";

const HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};

function response(payload, status = 200) {
  return Response.json(payload, { status, headers: HEADERS });
}

function clean(value, limit = 180) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function integer(value, fallback, min, max) {
  const number = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function migrationMissing(error) {
  const text = String(error?.message || error || "").toLowerCase();
  return text.includes("sports_analytics_") && (text.includes("does not exist") || text.includes("schema cache"));
}

function serializeSnapshot(row = {}) {
  return {
    id: row.id || null,
    eventId: row.event_id,
    sportKey: row.sport_key,
    canonicalSport: row.canonical_sport,
    league: row.league,
    match: row.match,
    commenceTime: row.commence_time,
    capturedAt: row.captured_at,
    captureBucket: row.capture_bucket,
    observationCount: Number(row.observation_count || 0),
    providerCount: Number(row.provider_count || 0),
    coverageScore: Number(row.coverage_score || 0),
    availableMetrics: Array.isArray(row.available_metrics) ? row.available_metrics : [],
    missingMetrics: Array.isArray(row.missing_metrics) ? row.missing_metrics : [],
    familyCoverage: Array.isArray(row.family_coverage) ? row.family_coverage : [],
    providerStatus: row.provider_status && typeof row.provider_status === "object" ? row.provider_status : {},
    golfProfile: Array.isArray(row.golf_profile) ? row.golf_profile : [],
    rawSummary: row.raw_summary && typeof row.raw_summary === "object" ? row.raw_summary : {},
    paperOnly: row.paper_only !== false
  };
}

function serializeObservation(row = {}) {
  return {
    eventId: row.event_id,
    sportKey: row.sport_key,
    canonicalSport: row.canonical_sport,
    league: row.league,
    participantId: row.participant_id,
    family: row.family,
    metric: row.metric,
    value: row.value === null || row.value === undefined ? null : Number(row.value),
    unit: row.unit,
    observedAt: row.observed_at,
    capturedAt: row.captured_at,
    provider: row.provider,
    sourceTrust: Number(row.source_trust || 0),
    confidence: Number(row.confidence || 0),
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {}
  };
}

async function loadStored(admin, { sport, eventId, hours, limit }) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  let snapshotQuery = admin
    .from("sports_analytics_snapshots")
    .select("id,event_id,sport_key,canonical_sport,league,match,commence_time,captured_at,capture_bucket,observation_count,provider_count,coverage_score,available_metrics,missing_metrics,family_coverage,provider_status,golf_profile,raw_summary,paper_only")
    .gte("captured_at", since)
    .order("captured_at", { ascending: false })
    .limit(limit);
  if (sport) snapshotQuery = snapshotQuery.eq("canonical_sport", sport);
  if (eventId) snapshotQuery = snapshotQuery.eq("event_id", eventId);
  const { data: snapshotRows, error: snapshotError } = await snapshotQuery;
  if (snapshotError) throw snapshotError;

  const eventIds = [...new Set((snapshotRows || []).map((row) => row.event_id).filter(Boolean))];
  let observationRows = [];
  if (eventIds.length) {
    let observationQuery = admin
      .from("sports_analytics_observations")
      .select("event_id,sport_key,canonical_sport,league,participant_id,family,metric,value,unit,observed_at,captured_at,provider,source_trust,confidence,metadata")
      .in("event_id", eventIds.slice(0, 100))
      .gte("captured_at", since)
      .order("captured_at", { ascending: false })
      .limit(Math.min(5000, limit * 30));
    if (sport) observationQuery = observationQuery.eq("canonical_sport", sport);
    if (eventId) observationQuery = observationQuery.eq("event_id", eventId);
    const { data, error } = await observationQuery;
    if (error) throw error;
    observationRows = data || [];
  }

  return {
    snapshots: (snapshotRows || []).map(serializeSnapshot),
    rawSnapshots: snapshotRows || [],
    observations: observationRows.map(serializeObservation)
  };
}

async function loadLiveFallback(origin, { sport, eventId }) {
  const topPicksResponse = await fetch(`${origin}/api/top-picks`, {
    cache: "no-store",
    signal: AbortSignal.timeout(75_000)
  });
  const payload = await topPicksResponse.json();
  if (!topPicksResponse.ok || payload?.ok === false) return { snapshots: [], observations: [], rawSnapshots: [] };
  const capturedAt = new Date().toISOString();
  const unique = new Map();
  for (const pick of Array.isArray(payload.data) ? payload.data : []) {
    const id = clean(pick.gameId || pick.eventId || pick.id, 180);
    const canonicalSport = canonicalSportFromKey(pick.sportKey || pick.league || pick.sportTitle);
    if (!id || unique.has(id)) continue;
    if (eventId && id !== eventId) continue;
    if (sport && canonicalSport !== sport) continue;
    unique.set(id, pick);
  }

  const snapshots = [];
  const observations = [];
  const rawSnapshots = [];
  for (const pick of [...unique.values()].slice(0, 20)) {
    const rows = buildAutomaticObservationsFromPick(pick, { capturedAt });
    const raw = buildSportsAnalyticsSnapshot({
      pick,
      observations: rows,
      providerStatus: {
        automatic: { source: "scorecaster-unified-data", mode: rows.length ? "live" : "unavailable", ok: rows.length > 0, observationCount: rows.length },
        external: { ...sportsAnalyticsProviderConfiguration(), mode: "worker-only", ok: false, observationCount: 0 }
      },
      capturedAt
    });
    rawSnapshots.push(raw);
    snapshots.push(serializeSnapshot(raw));
    observations.push(...rows.map((row) => serializeObservation({
      event_id: raw.event_id,
      sport_key: raw.sport_key,
      canonical_sport: raw.canonical_sport,
      league: raw.league,
      participant_id: row.participantId,
      family: row.family,
      metric: row.metric,
      value: row.value,
      unit: row.unit,
      observed_at: row.observedAt,
      captured_at: row.capturedAt,
      provider: row.provider,
      source_trust: row.sourceTrust,
      confidence: row.confidence,
      metadata: row.metadata
    })));
  }
  return { snapshots, observations, rawSnapshots };
}

export async function GET(request) {
  const url = new URL(request.url);
  const allowed = new Set(["sport", "eventId", "hours", "limit"]);
  if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) {
    return response({ ok: false, error: "Unsupported query parameter" }, 400);
  }
  const sport = clean(url.searchParams.get("sport"), 60).toLowerCase().replace(/[\s-]+/g, "_");
  const eventId = clean(url.searchParams.get("eventId"), 180);
  const hours = integer(url.searchParams.get("hours"), 168, 1, 720);
  const limit = integer(url.searchParams.get("limit"), 300, 10, 500);
  const admin = getSupabaseAdmin();

  try {
    let data;
    let storageAvailable = false;
    let liveFallback = false;
    if (admin) {
      try {
        data = await loadStored(admin, { sport, eventId, hours, limit });
        storageAvailable = true;
      } catch (error) {
        if (!migrationMissing(error)) throw error;
      }
    }
    if (!data || data.snapshots.length === 0) {
      data = await loadLiveFallback(url.origin, { sport, eventId });
      liveFallback = true;
    }

    const now = Date.now();
    const summary = summarizeSportsAnalyticsSnapshots(data.rawSnapshots);
    const insights = buildSportsAnalyticsInsights({ snapshots: data.rawSnapshots, observations: data.observations, now });
    const activationPlan = buildSportsAnalyticsActivationPlan(data.rawSnapshots);
    return response({
      ok: true,
      version: "sports-analytics-api-v2",
      generatedAt: new Date(now).toISOString(),
      storageAvailable,
      liveFallback,
      migrationRequired: storageAvailable ? null : "supabase/scorecaster_sports_analytics.sql",
      automaticCapture: {
        enabledByWorkflow: true,
        intervalMinutes: 30,
        worker: "/api/internal/sports-analytics"
      },
      externalProvider: sportsAnalyticsProviderConfiguration(),
      filters: { sport: sport || null, eventId: eventId || null, hours, limit },
      summary,
      insights,
      activationPlan,
      snapshots: data.snapshots,
      observations: data.observations,
      export: {
        csv: `/api/sports-analytics/export?${new URLSearchParams({ ...(sport ? { sport } : {}), ...(eventId ? { eventId } : {}), hours: String(hours), limit: String(limit) }).toString()}`
      },
      safety: {
        probabilitySource: "no-vig market consensus",
        analyticsCanUpgradeDecision: false,
        productionProbabilityChanged: false,
        paperOnly: true
      }
    });
  } catch (error) {
    return response({
      ok: false,
      error: process.env.NODE_ENV === "production" ? "Sports analytics data could not be loaded" : String(error),
      snapshots: [],
      observations: []
    }, 500);
  }
}
