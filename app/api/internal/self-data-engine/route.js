import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { GET as runCollectorRoute } from "../collector/route";
import { GET as runSportsAnalyticsRoute } from "../sports-analytics/route";
import { GET as getTopPicksRoute } from "../../top-picks/route";
import {
  SELF_DATA_ENGINE_VERSION,
  buildPointInTimeFeatureSnapshot,
  buildAutonomousDecision,
} from "../../../../lib/self-data-engine-v1.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const response = (payload, status = 200) => Response.json(payload, { status, headers: HEADERS });
const authorized = (request) => Boolean(process.env.CRON_SECRET) && request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
const clean = (value, limit = 180) => String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);

function eventId(pick = {}) {
  return clean(pick.gameId || pick.eventId || pick.id, 180);
}

async function payloadFromResponse(routeResponse) {
  const text = await routeResponse.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { raw: text.slice(0, 1000) }; }
}

async function runInternal(route, request) {
  try {
    const result = await route(request);
    const payload = await payloadFromResponse(result);
    return { ok: result.ok && payload?.ok !== false, status: result.status, payload };
  } catch (error) {
    return { ok: false, status: 500, payload: { error: error instanceof Error ? error.message : String(error) } };
  }
}

async function createRun(admin, startedAt) {
  const { data, error } = await admin
    .from("scorecaster_data_engine_runs_v1")
    .insert({ started_at: startedAt, status: "running", trigger_type: "scheduled", paper_only: true })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function finishRun(admin, runId, patch) {
  const { error } = await admin.from("scorecaster_data_engine_runs_v1").update(patch).eq("id", runId);
  if (error) throw error;
}

async function fetchTopPicks(origin) {
  const req = new Request(`${origin}/api/top-picks`, { method: "GET", headers: { Accept: "application/json" } });
  const res = await getTopPicksRoute(req);
  const payload = await res.json().catch(() => null);
  if (!res.ok || payload?.ok === false) throw new Error(payload?.error || payload?.reason || "Top Picks unavailable");
  return { payload, picks: Array.isArray(payload?.data) ? payload.data : [] };
}

async function loadPointInTimeRows(admin, eventIds, asOf) {
  if (!eventIds.length) return { collectorRows: [], observationRows: [] };

  const [collectorResult, analyticsResult] = await Promise.all([
    admin
      .from("collector_records")
      .select("event_id,entity_id,source_id,metric,value,observed_at,collected_at,commercial_use_allowed,publishable,payload")
      .in("event_id", eventIds)
      .lte("observed_at", asOf)
      .lte("collected_at", asOf)
      .order("observed_at", { ascending: false })
      .limit(5000),
    admin
      .from("sports_analytics_observations")
      .select("event_id,participant_id,family,metric,value,unit,observed_at,captured_at,provider,source_trust,confidence,metadata")
      .in("event_id", eventIds)
      .lte("observed_at", asOf)
      .lte("captured_at", asOf)
      .order("observed_at", { ascending: false })
      .limit(5000),
  ]);

  if (collectorResult.error) throw collectorResult.error;
  if (analyticsResult.error) throw analyticsResult.error;
  return {
    collectorRows: Array.isArray(collectorResult.data) ? collectorResult.data : [],
    observationRows: Array.isArray(analyticsResult.data) ? analyticsResult.data : [],
  };
}

async function storeFeatureAndDecision(admin, { pick, collectorRows, observationRows, runId, asOf }) {
  const feature = buildPointInTimeFeatureSnapshot({ pick, collectorRows, observationRows, runId, asOf });
  if (!feature.event_id) return null;

  const { data: storedFeature, error: featureError } = await admin
    .from("scorecaster_pit_feature_snapshots_v1")
    .upsert(feature, { onConflict: "event_id,as_of_bucket,feature_schema_version" })
    .select("id,event_id,input_hash,eligible_for_model,leakage_guard_passed,data_quality,as_of_bucket")
    .single();
  if (featureError) throw featureError;

  const decision = buildAutonomousDecision({
    pick,
    featureSnapshot: { ...feature, ...storedFeature },
    featureSnapshotId: storedFeature.id,
    runId,
    asOf,
  });

  const { data: storedDecision, error: decisionError } = await admin
    .from("scorecaster_autonomous_decisions_v1")
    .upsert(decision, { onConflict: "decision_hash" })
    .select("id,event_id,decision,selection,reason_codes,decision_hash")
    .single();
  if (decisionError) throw decisionError;

  return {
    eventId: storedFeature.event_id,
    featureSnapshotId: storedFeature.id,
    inputHash: storedFeature.input_hash,
    eligibleForModel: storedFeature.eligible_for_model,
    leakageGuardPassed: storedFeature.leakage_guard_passed,
    dataQuality: storedFeature.data_quality,
    decision: storedDecision.decision,
    selection: storedDecision.selection,
    reasons: storedDecision.reason_codes,
  };
}

export async function GET(request) {
  if (!process.env.CRON_SECRET) return response({ ok: false, error: "CRON_SECRET is not configured" }, 503);
  if (!authorized(request)) return response({ ok: false, error: "Unauthorized" }, 401);
  const admin = getSupabaseAdmin();
  if (!admin) return response({ ok: false, error: "Supabase admin client is not configured" }, 503);

  const startedAt = new Date().toISOString();
  let runId = null;
  try {
    runId = await createRun(admin, startedAt);
    const origin = new URL(request.url).origin;
    const errors = [];

    // Collection precedes feature materialization. Each downstream layer still
    // applies its own chronology gate and can fail independently.
    const collector = await runInternal(runCollectorRoute, request);
    if (!collector.ok) errors.push({ stage: "collector", error: collector.payload?.error || `HTTP ${collector.status}` });

    const analytics = await runInternal(runSportsAnalyticsRoute, request);
    if (!analytics.ok) errors.push({ stage: "sports-analytics", error: analytics.payload?.error || `HTTP ${analytics.status}` });

    const { payload: topPicksPayload, picks } = await fetchTopPicks(origin);
    const unique = new Map();
    for (const pick of picks) {
      const id = eventId(pick);
      if (id && !unique.has(id)) unique.set(id, pick);
      if (unique.size >= 20) break;
    }
    const eventPicks = [...unique.values()];
    const eventIds = eventPicks.map(eventId);
    const rows = await loadPointInTimeRows(admin, eventIds, startedAt);

    const settled = await Promise.allSettled(eventPicks.map((pick) => storeFeatureAndDecision(admin, {
      pick,
      collectorRows: rows.collectorRows,
      observationRows: rows.observationRows,
      runId,
      asOf: startedAt,
    })));

    const stored = settled.filter((item) => item.status === "fulfilled" && item.value).map((item) => item.value);
    for (const item of settled) {
      if (item.status === "rejected") errors.push({ stage: "feature-decision", error: item.reason instanceof Error ? item.reason.message : String(item.reason) });
    }

    const status = stored.length === 0 ? "failed" : errors.length ? "partial" : "success";
    const completedAt = new Date().toISOString();
    const sourceStatus = {
      collector: { ok: collector.ok, status: collector.status, runId: collector.payload?.runId || null, recordsStored: collector.payload?.recordsStored || 0 },
      sportsAnalytics: { ok: analytics.ok, status: analytics.status, eventsStored: analytics.payload?.eventsStored || 0, observationsStored: analytics.payload?.observationsStored || 0 },
      recommendationFeed: { ok: true, version: topPicksPayload?.version || null, events: eventPicks.length },
    };

    await finishRun(admin, runId, {
      completed_at: completedAt,
      status,
      collector_run_id: collector.payload?.runId || null,
      events_seen: eventPicks.length,
      feature_snapshots: stored.length,
      decisions_written: stored.length,
      source_status: sourceStatus,
      errors,
      paper_only: true,
    });

    return response({
      ok: status !== "failed",
      version: SELF_DATA_ENGINE_VERSION,
      runId,
      startedAt,
      completedAt,
      status,
      eventsSeen: eventPicks.length,
      featureSnapshots: stored.length,
      decisionsWritten: stored.length,
      eligibleForModel: stored.filter((item) => item.eligibleForModel).length,
      leakageGuardPassed: stored.filter((item) => item.leakageGuardPassed).length,
      decisions: {
        PLAY: stored.filter((item) => item.decision === "PLAY").length,
        CAUTION: stored.filter((item) => item.decision === "CAUTION").length,
        SKIP: stored.filter((item) => item.decision === "SKIP").length,
      },
      sources: sourceStatus,
      errors,
      sample: stored.slice(0, 5),
      autonomousCollection: true,
      pointInTimeFeatures: true,
      automaticUpgradeBySelfDataLayer: false,
      productionProbabilityChanged: false,
      realMoneyActionAvailable: false,
      paperOnly: true,
    }, status === "failed" ? 503 : 200);
  } catch (error) {
    if (runId) {
      await finishRun(admin, runId, {
        completed_at: new Date().toISOString(),
        status: "failed",
        errors: [{ stage: "fatal", error: error instanceof Error ? error.message : String(error) }],
      }).catch(() => null);
    }
    return response({ ok: false, version: SELF_DATA_ENGINE_VERSION, error: process.env.NODE_ENV === "production" ? "Self data engine failed" : String(error), paperOnly: true }, 500);
  }
}
