import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { liveMonitorProviderConfiguration } from "../../../../lib/live-monitor-json-provider";

export const dynamic = "force-dynamic";

function missingPatch(error) {
  return error?.code === "42P01" || /live_monitor_|live_event_snapshots_v1|does not exist|schema cache/i.test(String(error?.message || error || ""));
}

export async function GET() {
  const provider = liveMonitorProviderConfiguration();
  const admin = getSupabaseAdmin();
  if (!admin) return Response.json({ ok: false, version: "scorecaster-verified-live-monitor-v1", status: "database-unconfigured", provider, paperOnly: true }, { status: 503, headers: { "Cache-Control": "no-store" } });

  try {
    const since = new Date(Date.now() - 24 * 3600000).toISOString();
    const [runs, snapshots, alerts, latestRun, latestSnapshot] = await Promise.all([
      admin.from("live_monitor_runs_v1").select("id", { count: "exact", head: true }).gte("created_at", since),
      admin.from("live_event_snapshots_v1").select("id", { count: "exact", head: true }).gte("captured_at", since),
      admin.from("live_monitor_alerts_v1").select("id", { count: "exact", head: true }).gte("created_at", since),
      admin.from("live_monitor_runs_v1").select("status,event_count,received_count,accepted_count,rejected_count,alert_count,started_at,completed_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("live_event_snapshots_v1").select("provider_id,source_id,status,provider_updated_at,captured_at").order("captured_at", { ascending: false }).limit(1).maybeSingle()
    ]);
    for (const result of [runs, snapshots, alerts, latestRun, latestSnapshot]) if (result.error) throw result.error;
    const latestProviderAgeSeconds = latestSnapshot.data?.provider_updated_at ? Math.max(0, (Date.now() - Date.parse(latestSnapshot.data.provider_updated_at)) / 1000) : null;
    return Response.json({
      ok: true,
      version: "scorecaster-verified-live-monitor-v1",
      status: provider.enabled && provider.productionAllowed ? "ready" : provider.enabled ? "provider-blocked" : "disabled",
      provider,
      last24Hours: { runs: runs.count || 0, snapshots: snapshots.count || 0, alerts: alerts.count || 0 },
      latestRun: latestRun.data || null,
      latestSnapshot: latestSnapshot.data ? {
        providerId: latestSnapshot.data.provider_id,
        sourceId: latestSnapshot.data.source_id,
        status: latestSnapshot.data.status,
        providerUpdatedAt: latestSnapshot.data.provider_updated_at,
        capturedAt: latestSnapshot.data.captured_at,
        providerAgeSeconds: latestProviderAgeSeconds === null ? null : Number(latestProviderAgeSeconds.toFixed(1))
      } : null,
      userIdentifiersReturned: false,
      alertEvidenceReturned: false,
      rawProviderPayloadReturned: false,
      apiKeysReturned: false,
      preMatchModelChanged: false,
      realMoneyExecution: false,
      paperOnly: true
    }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    return Response.json({
      ok: false,
      version: "scorecaster-verified-live-monitor-v1",
      status: missingPatch(error) ? "patch-required" : "unavailable",
      provider,
      requiredPatch: missingPatch(error) ? "scripts/apply-verified-live-monitor-v1.sql" : undefined,
      paperOnly: true
    }, { status: missingPatch(error) ? 503 : 500, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  }
}
