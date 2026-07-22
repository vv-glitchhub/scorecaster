import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import {
  buildDiagnosticSnapshot,
  evaluateDiagnosticAlerts
} from "../../../../lib/decision-diagnostics-v2.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function response(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function hourlyBucket(date = new Date()) {
  const bucket = new Date(date);
  bucket.setUTCMinutes(0, 0, 0);
  return bucket.toISOString();
}

function snapshotRow(snapshot) {
  return {
    capture_bucket: hourlyBucket(new Date(snapshot.capturedAt)),
    captured_at: snapshot.capturedAt,
    source: snapshot.source,
    fixture_source: snapshot.fixtureSource,
    league_selection_mode: snapshot.leagueSelectionMode,
    default_league_season: snapshot.defaultLeagueSeason,
    selected_leagues: snapshot.selectedLeagues,
    status: snapshot.status,
    total: snapshot.total,
    play_count: snapshot.counts.PLAY,
    caution_count: snapshot.counts.CAUTION,
    skip_count: snapshot.counts.SKIP,
    stale_rate: snapshot.dataQuality.staleRate,
    average_bookmakers: snapshot.dataQuality.averageBookmakers,
    average_confidence: snapshot.dataQuality.averageConfidence,
    average_age_hours: snapshot.dataQuality.averageAgeHours,
    reasons: snapshot.reasons,
    leagues: snapshot.leagues,
    provider_health: snapshot.providerHealth,
    thresholds: snapshot.thresholds,
    picks: snapshot.picks
  };
}

function historySnapshot(row) {
  return {
    capturedAt: row.captured_at,
    total: Number(row.total || 0),
    counts: {
      PLAY: Number(row.play_count || 0),
      CAUTION: Number(row.caution_count || 0),
      SKIP: Number(row.skip_count || 0)
    },
    dataQuality: { staleRate: Number(row.stale_rate || 0) },
    providerHealth: row.provider_health || {}
  };
}

async function syncAlerts(admin, alerts, now) {
  const activeFingerprints = new Set(alerts.map((alert) => alert.fingerprint));
  for (const alert of alerts) {
    const { error } = await admin.from("decision_diagnostic_alerts").upsert({
      fingerprint: alert.fingerprint,
      alert_type: alert.alertType,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      details: alert.details,
      active: true,
      last_seen_at: now,
      resolved_at: null
    }, { onConflict: "fingerprint" });
    if (error) throw error;
  }

  const { data: activeRows, error: activeError } = await admin
    .from("decision_diagnostic_alerts")
    .select("id,fingerprint")
    .eq("active", true);
  if (activeError) throw activeError;

  const resolved = (activeRows || []).filter((row) => !activeFingerprints.has(row.fingerprint));
  for (const row of resolved) {
    const { error } = await admin
      .from("decision_diagnostic_alerts")
      .update({ active: false, resolved_at: now, last_seen_at: now })
      .eq("id", row.id);
    if (error) throw error;
  }

  return { active: alerts.length, resolved: resolved.length };
}

export async function GET(request) {
  if (!process.env.CRON_SECRET) {
    return response({ ok: false, error: "Decision Diagnostics cron secret is not configured" }, 503);
  }
  if (!authorized(request)) return response({ ok: false, error: "Unauthorized" }, 401);

  const admin = getSupabaseAdmin();
  if (!admin) return response({ ok: false, error: "Supabase admin client is not configured" }, 503);

  try {
    const origin = new URL(request.url).origin;
    const topPicksResponse = await fetch(`${origin}/api/top-picks`, {
      cache: "no-store",
      signal: AbortSignal.timeout(30000)
    });
    const topPicks = await topPicksResponse.json();
    if (!topPicksResponse.ok || topPicks?.ok === false) {
      return response({ ok: false, error: topPicks?.error || topPicks?.reason || "Top Picks unavailable" }, 503);
    }

    const now = new Date().toISOString();
    const snapshot = buildDiagnosticSnapshot(topPicks, { capturedAt: now });
    const { data: historyRows, error: historyError } = await admin
      .from("decision_diagnostic_snapshots")
      .select("captured_at,total,play_count,caution_count,skip_count,stale_rate,provider_health")
      .order("captured_at", { ascending: false })
      .limit(12);
    if (historyError) throw historyError;

    const { data: stored, error: snapshotError } = await admin
      .from("decision_diagnostic_snapshots")
      .upsert(snapshotRow(snapshot), { onConflict: "capture_bucket" })
      .select("id,captured_at")
      .single();
    if (snapshotError) throw snapshotError;

    const alerts = evaluateDiagnosticAlerts(snapshot, (historyRows || []).map(historySnapshot));
    const alertSync = await syncAlerts(admin, alerts, now);

    return response({
      ok: true,
      version: snapshot.version,
      snapshot: { id: stored.id, capturedAt: stored.captured_at, status: snapshot.status, counts: snapshot.counts },
      providerHealth: snapshot.providerHealth,
      alerts: alertSync
    });
  } catch (error) {
    return response({
      ok: false,
      error: process.env.NODE_ENV === "production" ? "Decision Diagnostics capture failed" : String(error)
    }, 500);
  }
}