import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { collectorRegistrySummary } from "../../../../lib/collector-source-registry.mjs";
import { buildCollectorCoverage, buildCollectorSourceQuality, detectCollectorIncidents } from "../../../../lib/collector-insights.mjs";

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
      version: "scorecaster-collector-health-v2",
      databaseConfigured: false,
      registry: { total: registry.total, productionApproved: registry.productionApproved }
    }, 503);
  }

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [latestRun, recentRuns, runCount, recordCount, publishableCount, recentRecords] = await Promise.all([
      admin.from("collector_runs").select("id,status,started_at,completed_at,accepted_count,rejected_count,publishable_count,research_only_count,source_status").order("started_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("collector_runs").select("status,accepted_count,rejected_count,publishable_count,started_at").gte("started_at", since).order("started_at", { ascending: false }).limit(100),
      admin.from("collector_runs").select("id", { count: "exact", head: true }).gte("started_at", since),
      admin.from("collector_records").select("id", { count: "exact", head: true }).gte("collected_at", since),
      admin.from("collector_records").select("id", { count: "exact", head: true }).eq("publishable", true).gte("collected_at", since),
      admin.from("collector_records").select("source_id,event_id,sport,metric,observed_at,collected_at,confidence,source_trust").eq("publishable", true).gte("collected_at", since).order("collected_at", { ascending: false }).limit(1000)
    ]);
    for (const result of [latestRun, recentRuns, runCount, recordCount, publishableCount, recentRecords]) if (result.error) throw result.error;

    const lastStartedAt = latestRun.data?.started_at || null;
    const ageMinutes = lastStartedAt ? Math.max(0, Math.round((Date.now() - new Date(lastStartedAt).getTime()) / 60_000)) : null;
    const stale = ageMinutes === null || ageMinutes > 90;
    const lastFailed = latestRun.data?.status === "failed";
    const runRows = Array.isArray(recentRuns.data) ? recentRuns.data : [];
    const successfulRuns = runRows.filter((run) => run.status === "success").length;
    const partialRuns = runRows.filter((run) => run.status === "partial").length;
    const failedRuns = runRows.filter((run) => run.status === "failed").length;
    const accepted = runRows.reduce((sum, run) => sum + Number(run.accepted_count || 0), 0);
    const rejected = runRows.reduce((sum, run) => sum + Number(run.rejected_count || 0), 0);
    const successRate = runRows.length ? (successfulRuns + partialRuns * 0.5) / runRows.length : 0;
    const rejectionRate = accepted + rejected ? rejected / (accepted + rejected) : 0;
    const records = Array.isArray(recentRecords.data) ? recentRecords.data : [];
    const sourceQuality = buildCollectorSourceQuality(records);
    const coverage = buildCollectorCoverage(records);
    const incidents = detectCollectorIncidents({ records, sourceQuality, coverage });
    const criticalIncident = incidents.some((incident) => incident.severity === "critical");
    const status = lastFailed || criticalIncident ? "degraded" : stale ? "stale" : "healthy";

    return response({
      ok: status === "healthy",
      status,
      version: "scorecaster-collector-health-v2",
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
        successfulRuns,
        partialRuns,
        failedRuns,
        successRate: Math.round(successRate * 1000) / 1000,
        accepted,
        rejected,
        rejectionRate: Math.round(rejectionRate * 1000) / 1000,
        records: Number(recordCount.count || 0),
        publishableRecords: Number(publishableCount.count || 0)
      },
      coverage: coverage.totals,
      sourceQuality,
      incidents,
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
      version: "scorecaster-collector-health-v2",
      migrationActive: false,
      migrationRequired: migrationMissing(error) ? "supabase/scorecaster_collector_v1.sql" : undefined,
      error: process.env.NODE_ENV === "production" ? "Collector health check failed" : String(error)
    }, 503);
  }
}
