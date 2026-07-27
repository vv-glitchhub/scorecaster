import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { collectorRegistrySummary } from "../../../../lib/collector-source-registry.mjs";

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

function response(payload, status = 200) {
  return Response.json(payload, { status, headers: HEADERS });
}

function migrationMissing(error) {
  const text = String(error?.message || error || "").toLowerCase();
  return text.includes("collector_") && (text.includes("does not exist") || text.includes("schema cache"));
}

export async function GET() {
  const admin = getSupabaseAdmin();
  const registry = collectorRegistrySummary();
  if (!admin) {
    return response({
      ok: false,
      status: "not-configured",
      databaseConfigured: false,
      registry: { total: registry.total, productionApproved: registry.productionApproved }
    }, 503);
  }

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [latestRun, runCount, recordCount, publishableCount] = await Promise.all([
      admin.from("collector_runs").select("id,status,started_at,completed_at,accepted_count,rejected_count,publishable_count,research_only_count,source_status").order("started_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("collector_runs").select("id", { count: "exact", head: true }).gte("started_at", since),
      admin.from("collector_records").select("id", { count: "exact", head: true }).gte("collected_at", since),
      admin.from("collector_records").select("id", { count: "exact", head: true }).eq("publishable", true).gte("collected_at", since)
    ]);
    for (const result of [latestRun, runCount, recordCount, publishableCount]) if (result.error) throw result.error;

    const lastStartedAt = latestRun.data?.started_at || null;
    const ageMinutes = lastStartedAt ? Math.max(0, Math.round((Date.now() - new Date(lastStartedAt).getTime()) / 60_000)) : null;
    const stale = ageMinutes === null || ageMinutes > 90;
    const lastFailed = latestRun.data?.status === "failed";
    const status = lastFailed ? "degraded" : stale ? "stale" : "healthy";

    return response({
      ok: status === "healthy",
      status,
      version: "scorecaster-collector-health-v1",
      checkedAt: new Date().toISOString(),
      databaseConfigured: true,
      migrationActive: true,
      lastRun: latestRun.data ? {
        id: latestRun.data.id,
        status: latestRun.data.status,
        startedAt: latestRun.data.started_at,
        completedAt: latestRun.data.completed_at,
        ageMinutes,
        accepted: Number(latestRun.data.accepted_count || 0),
        rejected: Number(latestRun.data.rejected_count || 0),
        publishable: Number(latestRun.data.publishable_count || 0),
        researchOnly: Number(latestRun.data.research_only_count || 0),
        sources: latestRun.data.source_status || []
      } : null,
      last24Hours: {
        runs: Number(runCount.count || 0),
        records: Number(recordCount.count || 0),
        publishableRecords: Number(publishableCount.count || 0)
      },
      registry: {
        total: registry.total,
        enabled: registry.enabled,
        productionApproved: registry.productionApproved,
        researchOnly: registry.researchOnly
      },
      safety: { paperOnly: true, probabilityChanged: false, researchDataPublished: false }
    }, status === "healthy" ? 200 : 503);
  } catch (error) {
    return response({
      ok: false,
      status: migrationMissing(error) ? "not-activated" : "error",
      migrationActive: false,
      migrationRequired: migrationMissing(error) ? "supabase/scorecaster_collector_v1.sql" : undefined,
      error: process.env.NODE_ENV === "production" ? "Collector health check failed" : String(error)
    }, 503);
  }
}
