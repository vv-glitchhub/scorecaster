import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { enrichPicksForUnifiedCapture } from "../../../../lib/unified-capture-enrichment-v1.mjs";
import { summarizeUnifiedCaptureSecondaryPricing } from "../../../../lib/unified-capture-secondary-summary-v1.mjs";
import {
  buildClosingRecord,
  buildProviderObservations,
  buildUnifiedDataSnapshot,
  evaluateUnifiedDataIncidents,
  summarizeProviderQuality
} from "../../../../lib/unified-sports-data-v2.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};
const MAX_FRESH_SKIP_MINUTES = 20;

function response(payload, status = 200) {
  return Response.json(payload, { status, headers: HEADERS });
}

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

function migrationMissing(error) {
  const text = String(error?.message || error || "").toLowerCase();
  return text.includes("unified_data_") && (text.includes("does not exist") || text.includes("schema cache"));
}

function requestedFreshSkipMinutes(request) {
  let parsed = 0;
  try {
    const raw = new URL(request.url).searchParams.get("skipIfFreshMinutes");
    if (raw === null || raw === "") return 0;
    parsed = Number(raw);
  } catch {
    return 0;
  }
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(MAX_FRESH_SKIP_MINUTES, Math.max(1, Math.trunc(parsed)));
}

async function latestCaptureFreshness(admin, now, minutes) {
  if (!minutes) return null;
  const { data, error } = await admin
    .from("unified_data_snapshots")
    .select("captured_at")
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const latestCapturedAt = data?.captured_at || null;
  const latestMs = Date.parse(String(latestCapturedAt || ""));
  if (!Number.isFinite(latestMs)) {
    return { fresh: false, latestCapturedAt: null, ageMinutes: null, thresholdMinutes: minutes };
  }
  const ageMinutes = Math.max(0, (now - latestMs) / 60_000);
  return {
    fresh: ageMinutes < minutes,
    latestCapturedAt,
    ageMinutes: Number(ageMinutes.toFixed(2)),
    thresholdMinutes: minutes
  };
}

async function upsertSnapshots(admin, picks, capturedAt) {
  const stored = [];
  const observations = [];
  for (const pick of picks) {
    const row = buildUnifiedDataSnapshot(pick, { capturedAt });
    if (!row) continue;
    const { data, error } = await admin
      .from("unified_data_snapshots")
      .upsert(row, { onConflict: "event_id,selection,capture_bucket" })
      .select("id,event_id,selection,captured_at,commence_time,sport_key,league,odds,provider_count,provider_disagreement,coverage_score,total_context_impact,safety_action,missing_families")
      .single();
    if (error) throw error;
    stored.push(data);
    observations.push(...buildProviderObservations(pick, data.id, { capturedAt }));
  }
  if (observations.length) {
    const { error } = await admin
      .from("unified_data_provider_observations")
      .upsert(observations, { onConflict: "snapshot_id,provider_key,family" });
    if (error) throw error;
  }
  return { stored, observationCount: observations.length };
}

function groupSnapshots(rows = []) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.event_id}:${row.selection}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.values()];
}

async function finalizeClosingRecords(admin, now) {
  const cutoff = new Date(now).toISOString();
  const lowerBound = new Date(now - 21 * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows, error } = await admin
    .from("unified_data_snapshots")
    .select("id,event_id,selection,sport_key,league,commence_time,odds,captured_at")
    .lte("commence_time", cutoff)
    .gte("commence_time", lowerBound)
    .order("captured_at", { ascending: true })
    .limit(5000);
  if (error) throw error;

  const records = groupSnapshots(rows || [])
    .map((group) => buildClosingRecord(group, { now }))
    .filter(Boolean);
  if (!records.length) return { finalized: 0, records: [] };

  const { data: saved, error: saveError } = await admin
    .from("unified_data_closing_records")
    .upsert(records, { onConflict: "event_id,selection" })
    .select("event_id,selection,opening_odds,closing_odds,price_clv,closing_captured_at");
  if (saveError) throw saveError;
  return { finalized: saved?.length || 0, records: saved || [] };
}

async function recentProviderQuality(admin, now) {
  const since = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("unified_data_provider_observations")
    .select("provider_key,family,mode,ok,trust,confidence,age_hours,divergence_from_primary,captured_at")
    .gte("captured_at", since)
    .order("captured_at", { ascending: false })
    .limit(2000);
  if (error) throw error;
  return summarizeProviderQuality(data || []);
}

async function syncIncidents(admin, incidents, nowIso) {
  const fingerprints = new Set(incidents.map((item) => item.fingerprint));
  for (const item of incidents) {
    const { error } = await admin.from("unified_data_incidents").upsert({
      fingerprint: item.fingerprint,
      incident_type: item.incidentType,
      severity: item.severity,
      title: item.title,
      message: item.message,
      event_id: item.eventId,
      provider_key: item.providerKey,
      details: item.details,
      active: true,
      last_seen_at: nowIso,
      resolved_at: null
    }, { onConflict: "fingerprint" });
    if (error) throw error;
  }

  const { data: active, error: activeError } = await admin
    .from("unified_data_incidents")
    .select("id,fingerprint")
    .eq("active", true);
  if (activeError) throw activeError;
  const resolved = (active || []).filter((row) => !fingerprints.has(row.fingerprint));
  for (const row of resolved) {
    const { error } = await admin
      .from("unified_data_incidents")
      .update({ active: false, resolved_at: nowIso, last_seen_at: nowIso })
      .eq("id", row.id);
    if (error) throw error;
  }
  return { active: incidents.length, resolved: resolved.length };
}

export async function GET(request) {
  if (!process.env.CRON_SECRET) return response({ ok: false, error: "Unified data cron secret is not configured" }, 503);
  if (!authorized(request)) return response({ ok: false, error: "Unauthorized" }, 401);
  const admin = getSupabaseAdmin();
  if (!admin) return response({ ok: false, error: "Supabase admin client is not configured" }, 503);

  try {
    const now = Date.now();
    const freshSkipMinutes = requestedFreshSkipMinutes(request);
    const freshness = await latestCaptureFreshness(admin, now, freshSkipMinutes);
    if (freshness?.fresh) {
      return response({
        ok: true,
        version: "unified-sports-data-worker-v4",
        skipped: true,
        reason: "fresh-capture",
        latestCapturedAt: freshness.latestCapturedAt,
        ageMinutes: freshness.ageMinutes,
        freshnessThresholdMinutes: freshness.thresholdMinutes,
        providerRequestsMade: false,
        paperOnly: true
      });
    }

    const capturedAt = new Date(now).toISOString();
    const origin = new URL(request.url).origin;
    const topPicksResponse = await fetch(`${origin}/api/top-picks`, {
      cache: "no-store",
      signal: AbortSignal.timeout(75_000)
    });
    const topPicks = await topPicksResponse.json();
    if (!topPicksResponse.ok || topPicks?.ok === false) {
      return response({ ok: false, error: topPicks?.error || topPicks?.reason || "Top Picks unavailable" }, 503);
    }

    const publicPicks = Array.isArray(topPicks.data) ? topPicks.data : [];
    const capturePicks = await enrichPicksForUnifiedCapture(publicPicks, { now });
    const secondaryPricingCapture = summarizeUnifiedCaptureSecondaryPricing(capturePicks);
    const capture = await upsertSnapshots(admin, capturePicks, capturedAt);
    const providerQuality = await recentProviderQuality(admin, now);
    const incidents = evaluateUnifiedDataIncidents(capture.stored, providerQuality);
    const incidentSync = await syncIncidents(admin, incidents, capturedAt);
    const closing = await finalizeClosingRecords(admin, now);

    return response({
      ok: true,
      version: "unified-sports-data-worker-v4",
      skipped: false,
      capturedAt,
      freshnessThresholdMinutes: freshSkipMinutes || 0,
      selections: capture.stored.length,
      providerObservations: capture.observationCount,
      secondaryPricingCapture: {
        ...secondaryPricingCapture,
        acquisition: "protected-worker-only"
      },
      providerQuality,
      closingRecords: { finalized: closing.finalized, latest: closing.records.slice(0, 12) },
      incidents: incidentSync,
      paperOnly: true
    });
  } catch (error) {
    return response({
      ok: false,
      error: migrationMissing(error)
        ? "Unified data migration is not active"
        : process.env.NODE_ENV === "production"
          ? "Unified data capture failed"
          : String(error),
      migrationRequired: migrationMissing(error) ? "supabase/scorecaster_unified_data.sql" : undefined
    }, migrationMissing(error) ? 503 : 500);
  }
}
