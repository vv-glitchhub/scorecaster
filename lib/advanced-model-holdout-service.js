import { getSupabaseAdmin } from "./supabase-admin";
import { fetchRecentLeagueResults } from "./results-provider.js";
import { buildAdvancedModelHoldoutV1 } from "./advanced-model-holdout-v1.mjs";

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_SNAPSHOTS = 1200;
const MAX_LEAGUES = 16;
const cache = new Map();

function clean(value, limit = 160) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function boundedDays(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 90;
  return Math.max(7, Math.min(180, Math.trunc(parsed)));
}

function hasShadowModels(row = {}) {
  const summary = row.raw_summary && typeof row.raw_summary === "object" ? row.raw_summary : {};
  return Array.isArray(summary.shadowModels) && summary.shadowModels.length > 0;
}

function leagueKey(row = {}) {
  return `${clean(row.sport_key, 120)}|${clean(row.league, 140)}`;
}

export async function loadAdvancedModelHoldoutReport({ days = 90, now = Date.now() } = {}) {
  const windowDays = boundedDays(days);
  const cacheKey = `${windowDays}|${Math.floor(now / CACHE_TTL_MS)}`;
  const cached = cache.get(cacheKey);
  if (cached && now - cached.cachedAt <= CACHE_TTL_MS) return { ...cached.value, cached: true };

  const admin = getSupabaseAdmin();
  if (!admin) {
    return {
      ok: false,
      status: "unavailable",
      reason: "supabase-admin-not-configured",
      days: windowDays,
      report: buildAdvancedModelHoldoutV1([], [], { now }),
      cached: false
    };
  }

  const since = new Date(now - windowDays * 24 * 60 * 60 * 1000).toISOString();
  try {
    const { data, error } = await admin
      .from("sports_analytics_snapshots")
      .select("event_id,sport_key,canonical_sport,league,commence_time,captured_at,raw_summary")
      .gte("captured_at", since)
      .lte("captured_at", new Date(now).toISOString())
      .order("captured_at", { ascending: true })
      .limit(MAX_SNAPSHOTS);
    if (error) throw error;

    const snapshots = (Array.isArray(data) ? data : []).filter(hasShadowModels);
    const groups = new Map();
    for (const row of snapshots) {
      const key = leagueKey(row);
      if (!groups.has(key)) groups.set(key, { sportKey: row.sport_key, league: row.league });
    }
    const requestedGroups = [...groups.values()].slice(0, MAX_LEAGUES);
    const settled = await Promise.allSettled(requestedGroups.map((group) => fetchRecentLeagueResults({
      sportKey: group.sportKey,
      league: group.league,
      now
    })));
    const results = [];
    const providerFailures = [];
    settled.forEach((item, index) => {
      if (item.status === "fulfilled" && item.value?.ok) results.push(...(item.value.results || []));
      else providerFailures.push({
        sportKey: requestedGroups[index]?.sportKey || null,
        league: requestedGroups[index]?.league || null,
        reason: item.status === "rejected" ? "results-provider-rejected" : item.value?.mode || "results-provider-unavailable"
      });
    });

    const report = buildAdvancedModelHoldoutV1(snapshots, results, { now });
    const value = {
      ok: true,
      status: report.counts.immutablePregamePredictions > 0 ? "available" : "collecting",
      days: windowDays,
      since,
      snapshotRowsScanned: Array.isArray(data) ? data.length : 0,
      shadowSnapshotRows: snapshots.length,
      leaguesRequested: requestedGroups.length,
      resultsReceived: results.length,
      providerFailures,
      report,
      cached: false
    };
    cache.clear();
    cache.set(cacheKey, { cachedAt: now, value });
    return value;
  } catch (error) {
    return {
      ok: false,
      status: "degraded",
      reason: process.env.NODE_ENV === "production" ? "advanced-model-holdout-unavailable" : String(error),
      days: windowDays,
      report: buildAdvancedModelHoldoutV1([], [], { now }),
      cached: false
    };
  }
}

export const ADVANCED_MODEL_HOLDOUT_SERVICE_POLICY = Object.freeze({
  cacheMinutes: CACHE_TTL_MS / 60000,
  maximumSnapshotRows: MAX_SNAPSHOTS,
  maximumLeagueResultRequests: MAX_LEAGUES,
  maximumWindowDays: 180,
  minimumWindowDays: 7
});
