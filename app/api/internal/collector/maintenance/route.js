import { timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { GET as runCollector } from "../route";
import { GET as runUnifiedData } from "../../unified-data/route";
import { GET as runSportsAnalytics } from "../../sports-analytics/route";
import { GET as readUnifiedFreshness } from "../../../unified-data/freshness/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const SCHEDULER_SECRET_NAME = "production_data_pipeline_scheduler";
const SCHEDULER_TASKS = new Map([
  ["collector", { path: "/api/internal/collector", handler: runCollector }],
  ["unified-data", { path: "/api/internal/unified-data", handler: runUnifiedData }],
  ["sports-analytics", { path: "/api/internal/sports-analytics", handler: runSportsAnalytics }]
]);

function response(payload, status = 200) {
  return Response.json(payload, { status, headers: HEADERS });
}

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

function secureEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""), "utf8");
  const rightBuffer = Buffer.from(String(right || ""), "utf8");
  return leftBuffer.length > 0
    && leftBuffer.length === rightBuffer.length
    && timingSafeEqual(leftBuffer, rightBuffer);
}

async function schedulerAuthorization(request, admin) {
  const provided = request.headers.get("x-scorecaster-scheduler-token") || "";
  if (!provided) return { authorized: false, configured: true };

  const { data, error } = await admin
    .from("scorecaster_internal_secrets_v1")
    .select("secret_value")
    .eq("name", SCHEDULER_SECRET_NAME)
    .maybeSingle();

  if (error) return { authorized: false, configured: false, error: true };
  if (!data?.secret_value) return { authorized: false, configured: false };
  return { authorized: secureEqual(provided, data.secret_value), configured: true };
}

async function unifiedCaptureRequired() {
  try {
    const freshnessResponse = await readUnifiedFreshness();
    const freshness = await freshnessResponse.json().catch(() => null);
    if (!freshnessResponse.ok || freshness?.ok !== true) {
      return { required: true, reason: "freshness-unavailable" };
    }
    return {
      required: freshness.protectedWorkerRequired !== false,
      reason: freshness.protectedWorkerRequired === false ? "already-fresh" : "capture-required",
      ageMinutes: freshness.ageMinutes ?? null,
      thresholdMinutes: freshness.thresholdMinutes ?? null
    };
  } catch {
    return { required: true, reason: "freshness-unavailable" };
  }
}

async function invokeSchedulerTask(request, task) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return response({ ok: false, error: "Production worker secret is not configured", paperOnly: true }, 503);

  if (task === "unified-data") {
    const freshness = await unifiedCaptureRequired();
    if (!freshness.required) {
      return response({
        ok: true,
        version: "scorecaster-supabase-scheduler-v1",
        task,
        status: "skipped-fresh",
        freshness,
        paperOnly: true
      });
    }
  }

  const target = SCHEDULER_TASKS.get(task);
  const origin = new URL(request.url).origin;
  const internalRequest = new Request(`${origin}${target.path}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${cronSecret}`,
      "x-scorecaster-scheduler": "supabase-cron"
    }
  });

  const workerResponse = await target.handler(internalRequest);
  const worker = await workerResponse.json().catch(() => null);
  const ok = workerResponse.ok && worker?.ok !== false;

  return response({
    ok,
    version: "scorecaster-supabase-scheduler-v1",
    task,
    status: ok ? "completed" : "failed",
    workerStatus: workerResponse.status,
    workerVersion: worker?.version || null,
    workerRunId: worker?.runId || null,
    paperOnly: true
  }, ok ? 200 : workerResponse.status || 503);
}

function integer(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function migrationMissing(error) {
  const text = String(error?.message || error || "").toLowerCase();
  return text.includes("collector_") && (text.includes("does not exist") || text.includes("schema cache"));
}

export async function GET(request) {
  if (!process.env.CRON_SECRET) return response({ ok: false, error: "Collector maintenance secret is not configured" }, 503);
  if (!authorized(request)) return response({ ok: false, error: "Unauthorized" }, 401);
  const admin = getSupabaseAdmin();
  if (!admin) return response({ ok: false, error: "Supabase admin client is not configured" }, 503);
  const url = new URL(request.url);
  const allowed = new Set(["retentionDays", "apply"]);
  if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) return response({ ok: false, error: "Unsupported query parameter" }, 400);
  const retentionDays = integer(url.searchParams.get("retentionDays"), 730, 30, 3650);
  const apply = url.searchParams.get("apply") === "true";
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [oldRecords, oldRuns, missingEventIds, missingMetrics] = await Promise.all([
      admin.from("collector_records").select("id", { count: "exact", head: true }).lt("collected_at", cutoff),
      admin.from("collector_runs").select("id", { count: "exact", head: true }).lt("started_at", cutoff),
      admin.from("collector_records").select("id", { count: "exact", head: true }).is("event_id", null),
      admin.from("collector_records").select("id", { count: "exact", head: true }).is("metric", null)
    ]);
    for (const result of [oldRecords, oldRuns, missingEventIds, missingMetrics]) if (result.error) throw result.error;

    let deletedRecords = 0;
    let deletedRuns = 0;
    if (apply) {
      const [recordDelete, runDelete] = await Promise.all([
        admin.from("collector_records").delete().lt("collected_at", cutoff),
        admin.from("collector_runs").delete().lt("started_at", cutoff)
      ]);
      if (recordDelete.error) throw recordDelete.error;
      if (runDelete.error) throw runDelete.error;
      deletedRecords = Number(oldRecords.count || 0);
      deletedRuns = Number(oldRuns.count || 0);
    }

    return response({
      ok: true,
      version: "scorecaster-collector-maintenance-v1",
      completedAt: new Date().toISOString(),
      mode: apply ? "apply" : "dry-run",
      retentionDays,
      cutoff,
      eligibleRecords: Number(oldRecords.count || 0),
      eligibleRuns: Number(oldRuns.count || 0),
      deletedRecords,
      deletedRuns,
      integrity: {
        missingEventIds: Number(missingEventIds.count || 0),
        missingMetrics: Number(missingMetrics.count || 0),
        valid: Number(missingEventIds.count || 0) === 0 && Number(missingMetrics.count || 0) === 0
      },
      safety: { paperOnly: true, probabilityChanged: false, publishabilityChanged: false }
    });
  } catch (error) {
    return response({
      ok: false,
      error: migrationMissing(error) ? "Collector migration is not active" : process.env.NODE_ENV === "production" ? "Collector maintenance failed" : String(error),
      migrationRequired: migrationMissing(error) ? "supabase/scorecaster_collector_v1.sql" : undefined
    }, migrationMissing(error) ? 503 : 500);
  }
}

export async function POST(request) {
  const admin = getSupabaseAdmin();
  if (!admin) return response({ ok: false, error: "Scheduler storage is unavailable", paperOnly: true }, 503);

  const auth = await schedulerAuthorization(request, admin);
  if (!auth.configured) return response({ ok: false, error: "Scheduler is not configured", paperOnly: true }, 503);
  if (!auth.authorized) return response({ ok: false, error: "Unauthorized", paperOnly: true }, 401);

  const url = new URL(request.url);
  const allowed = new Set(["task"]);
  if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) return response({ ok: false, error: "Unsupported query parameter", paperOnly: true }, 400);
  const task = url.searchParams.get("task") || "";
  if (!SCHEDULER_TASKS.has(task)) return response({ ok: false, error: "Unsupported scheduler task", paperOnly: true }, 400);

  try {
    return await invokeSchedulerTask(request, task);
  } catch (error) {
    console.error("Supabase scheduler task failed", { task, error: String(error) });
    return response({ ok: false, error: "Scheduler task failed", task, paperOnly: true }, 500);
  }
}
