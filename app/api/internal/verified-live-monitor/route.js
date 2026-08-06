import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { fetchLiveMonitorRecords, liveMonitorProviderConfiguration } from "../../../../lib/live-monitor-json-provider";
import { buildVerifiedLiveMonitor } from "../../../../lib/verified-live-monitor-v1.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const response = (body, status = 200) => Response.json(body, { status, headers: HEADERS });
const clean = (value, maximum = 240) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

function missingPatch(error) {
  return error?.code === "42P01" || /live_monitor_|live_event_snapshots_v1|does not exist|schema cache/i.test(String(error?.message || error || ""));
}

function fingerprint(userId, eventId, alert) {
  return createHash("sha256").update([userId, eventId, alert.id, alert.evidenceObservedAt || alert.generatedAt].join("|"), "utf8").digest("hex");
}

function uniqueEvents(rows = []) {
  const events = new Map();
  for (const row of rows) {
    const eventId = clean(row.event_id, 180);
    if (!eventId) continue;
    events.set(eventId, {
      eventId,
      sport: clean(row.sport, 100),
      league: clean(row.league, 140) || null,
      homeTeam: clean(row.home_team, 140) || null,
      awayTeam: clean(row.away_team, 140) || null,
      commenceTime: row.commence_time
    });
  }
  return [...events.values()].slice(0, 250);
}

function utcMinutes(now = new Date()) {
  return now.getUTCHours() * 60 + now.getUTCMinutes();
}

function timeMinutes(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function quietNow(preference, now = new Date()) {
  const start = timeMinutes(preference?.quiet_start);
  const end = timeMinutes(preference?.quiet_end);
  if (start === null || end === null || start === end) return false;
  const current = utcMinutes(now);
  return start < end ? current >= start && current < end : current >= start || current < end;
}

function allowedAlert(alert, preference) {
  if (preference?.enabled === false || preference?.alerts_enabled === false) return false;
  if (quietNow(preference)) return false;
  if (alert.id === "live-probability-move") {
    const match = String(alert.message || "").match(/([+-]?\d+(?:\.\d+)?) percentage points/i);
    const delta = match ? Math.abs(Number(match[1])) / 100 : 0;
    const minimum = Number(preference?.minimum_probability_move ?? 0.05);
    if (delta < minimum) return false;
  }
  return true;
}

async function createRun(admin, startedAt) {
  const { data, error } = await admin.from("live_monitor_runs_v1").insert({
    status: "running",
    started_at: startedAt,
    paper_only: true
  }).select("id").single();
  if (error) throw error;
  return data.id;
}

async function finishRun(admin, runId, changes) {
  const { error } = await admin.from("live_monitor_runs_v1").update({
    ...changes,
    completed_at: new Date().toISOString()
  }).eq("id", runId);
  if (error) throw error;
}

async function loadWatchedEvents(admin, now) {
  const from = new Date(now.getTime() - 8 * 3600000).toISOString();
  const to = new Date(now.getTime() + 2 * 3600000).toISOString();
  const { data, error } = await admin
    .from("watchlist_items")
    .select("id,user_id,event_id,sport,league,home_team,away_team,match,selection,commence_time,active")
    .eq("active", true)
    .gte("commence_time", from)
    .lte("commence_time", to)
    .order("commence_time", { ascending: true })
    .limit(2000);
  if (error) throw error;
  return data || [];
}

async function existingSnapshotIds(admin, ids) {
  if (!ids.length) return new Set();
  const found = new Set();
  for (let index = 0; index < ids.length; index += 500) {
    const { data, error } = await admin.from("live_event_snapshots_v1").select("id").in("id", ids.slice(index, index + 500));
    if (error) throw error;
    for (const row of data || []) found.add(row.id);
  }
  return found;
}

async function loadMonitor(admin, eventId, generatedAt) {
  const since = new Date(Date.parse(generatedAt) - 12 * 3600000).toISOString();
  const { data, error } = await admin
    .from("live_event_snapshots_v1")
    .select("id,event_id,sport,league,market,provider_id,source_id,status,period,clock_seconds,clock_direction,home_team,away_team,home_score,away_score,commence_time,observed_at,provider_updated_at,captured_at,correction,correction_reason,supersedes_id,metrics,prices,live_probabilities,live_model_version")
    .eq("event_id", eventId)
    .gte("observed_at", since)
    .order("observed_at", { ascending: true })
    .limit(5000);
  if (error) throw error;
  return buildVerifiedLiveMonitor({ eventId, generatedAt, snapshots: data || [] });
}

async function userPreferences(admin, userIds) {
  const defaults = { enabled: true, alerts_enabled: true, quiet_start: null, quiet_end: null, max_alerts_per_hour: 3, minimum_probability_move: 0.05 };
  const result = new Map(userIds.map((id) => [id, { ...defaults, user_id: id }]));
  if (!userIds.length) return result;
  const { data, error } = await admin.from("live_monitor_preferences_v1").select("user_id,enabled,alerts_enabled,quiet_start,quiet_end,max_alerts_per_hour,minimum_probability_move").in("user_id", userIds);
  if (error) throw error;
  for (const row of data || []) result.set(row.user_id, { ...defaults, ...row });
  return result;
}

async function recentAlertCounts(admin, userIds, now) {
  const result = new Map(userIds.map((id) => [id, 0]));
  if (!userIds.length) return result;
  const since = new Date(now.getTime() - 3600000).toISOString();
  const { data, error } = await admin.from("live_monitor_alerts_v1").select("user_id").in("user_id", userIds).gte("first_seen_at", since).limit(10000);
  if (error) throw error;
  for (const row of data || []) result.set(row.user_id, (result.get(row.user_id) || 0) + 1);
  return result;
}

export async function GET(request) {
  if (!process.env.CRON_SECRET) return response({ ok: false, error: "Live monitor worker secret is not configured" }, 503);
  if (!authorized(request)) return response({ ok: false, error: "Unauthorized" }, 401);
  const configuration = liveMonitorProviderConfiguration();
  if (!configuration.enabled) return response({ ok: true, version: "scorecaster-live-monitor-worker-v1", status: "disabled", provider: configuration, paperOnly: true });

  const admin = getSupabaseAdmin();
  if (!admin) return response({ ok: false, error: "Supabase admin client is not configured" }, 503);
  const startedAt = new Date().toISOString();
  let runId = null;
  try {
    runId = await createRun(admin, startedAt);
    const now = new Date(startedAt);
    const watches = await loadWatchedEvents(admin, now);
    const events = uniqueEvents(watches);
    const provider = await fetchLiveMonitorRecords(events, { timeoutMs: 30000 });
    const accepted = provider.normalized?.accepted || [];
    const acceptedIds = new Set(accepted.map((item) => item.row.id));
    const supersedesIds = accepted.map((item) => item.row.supersedes_id).filter(Boolean);
    const existingSuperseded = await existingSnapshotIds(admin, supersedesIds);
    const rows = accepted.map((item) => ({
      ...item.row,
      run_id: runId,
      supersedes_id: item.row.supersedes_id && (acceptedIds.has(item.row.supersedes_id) || existingSuperseded.has(item.row.supersedes_id))
        ? item.row.supersedes_id
        : null
    }));

    let stored = 0;
    if (rows.length) {
      const { data, error } = await admin.from("live_event_snapshots_v1").upsert(rows, { onConflict: "id", ignoreDuplicates: true }).select("id");
      if (error) throw error;
      stored = data?.length || 0;
    }

    const monitors = new Map();
    for (const event of events) monitors.set(event.eventId, await loadMonitor(admin, event.eventId, new Date().toISOString()));

    const userIds = [...new Set(watches.map((row) => row.user_id).filter(Boolean))];
    const preferences = await userPreferences(admin, userIds);
    const alertCounts = await recentAlertCounts(admin, userIds, now);
    const alertRows = [];
    const alertFingerprints = new Set();

    for (const watch of watches) {
      const monitor = monitors.get(watch.event_id);
      const preference = preferences.get(watch.user_id);
      let currentCount = alertCounts.get(watch.user_id) || 0;
      const limit = Math.max(0, Math.min(6, Number(preference?.max_alerts_per_hour ?? 3)));
      for (const alert of monitor?.alerts || []) {
        if (currentCount >= limit || !allowedAlert(alert, preference)) continue;
        const key = fingerprint(watch.user_id, watch.event_id, alert);
        if (alertFingerprints.has(key)) continue;
        alertFingerprints.add(key);
        currentCount += 1;
        alertRows.push({
          user_id: watch.user_id,
          watchlist_id: watch.id,
          event_id: watch.event_id,
          fingerprint: key,
          alert_type: alert.id,
          severity: alert.severity,
          title: clean(alert.title, 180),
          message: clean(alert.message, 500),
          evidence: {
            version: monitor.version,
            auditVersion: monitor.auditVersion,
            eventId: monitor.eventId,
            alert,
            current: monitor.current,
            suspensionReason: monitor.suspensionReason,
            paperOnly: true
          },
          active: true,
          first_seen_at: alert.generatedAt,
          last_seen_at: alert.generatedAt,
          paper_only: true
        });
      }
      alertCounts.set(watch.user_id, currentCount);
    }

    let alertsStored = 0;
    if (alertRows.length) {
      const { data, error } = await admin.from("live_monitor_alerts_v1").upsert(alertRows, { onConflict: "user_id,fingerprint", ignoreDuplicates: true }).select("id");
      if (error) throw error;
      alertsStored = data?.length || 0;
    }

    const rejected = provider.normalized?.rejected?.length || 0;
    const status = provider.ok === false ? "failed" : rejected || provider.mode !== "live" ? "partial" : "success";
    await finishRun(admin, runId, {
      status,
      event_count: events.length,
      received_count: provider.normalized?.received || 0,
      accepted_count: accepted.length,
      rejected_count: rejected,
      alert_count: alertsStored,
      source_status: { mode: provider.mode, sourceId: provider.sourceId, provider: provider.configuration },
      errors: provider.ok === false ? [{ reason: provider.reason || "provider-failed" }] : []
    });

    return response({
      ok: status !== "failed",
      version: "scorecaster-live-monitor-worker-v1",
      runId,
      status,
      watchedSelections: watches.length,
      eventsRequested: events.length,
      received: provider.normalized?.received || 0,
      accepted: accepted.length,
      rejected,
      stored,
      alertsStored,
      suspendedEvents: [...monitors.values()].filter((monitor) => monitor.suspended).length,
      provider: provider.configuration,
      alertRateLimited: true,
      quietPeriodTimezone: "UTC",
      rawPayloadStored: false,
      preMatchModelChanged: false,
      stakeSuggested: false,
      realMoneyExecution: false,
      paperOnly: true
    }, status === "failed" ? 503 : 200);
  } catch (error) {
    if (runId) await finishRun(admin, runId, { status: "failed", errors: [{ reason: missingPatch(error) ? "patch-required" : "worker-failed" }] }).catch(() => null);
    return response({
      ok: false,
      version: "scorecaster-live-monitor-worker-v1",
      error: missingPatch(error) ? "Verified Live Monitor production patch is not active" : process.env.NODE_ENV === "production" ? "Live monitor worker failed" : String(error),
      requiredPatch: missingPatch(error) ? "scripts/apply-verified-live-monitor-v1.sql" : undefined,
      paperOnly: true
    }, missingPatch(error) ? 503 : 500);
  }
}
