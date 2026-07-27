import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { sportsAnalyticsProviderConfiguration } from "../../../../lib/sports-analytics-provider";

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

function response(payload, status = 200) {
  return Response.json(payload, { status, headers: HEADERS });
}

export async function GET() {
  const admin = getSupabaseAdmin();
  const provider = sportsAnalyticsProviderConfiguration();
  const checks = {
    databaseConfigured: Boolean(admin),
    externalProviderConfigured: provider.configured === true,
    tablesReachable: false,
    latestSnapshotAt: null,
    latestObservationAt: null,
    snapshotCount24h: 0,
    observationCount24h: 0
  };

  if (admin) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [snapshots, observations] = await Promise.all([
      admin.from("sports_analytics_snapshots").select("captured_at", { count: "exact" }).gte("captured_at", since).order("captured_at", { ascending: false }).limit(1),
      admin.from("sports_analytics_observations").select("captured_at", { count: "exact" }).gte("captured_at", since).order("captured_at", { ascending: false }).limit(1)
    ]);
    const migrationMissing = [snapshots.error, observations.error].some((error) => String(error?.message || "").toLowerCase().includes("sports_analytics_"));
    if (!migrationMissing && !snapshots.error && !observations.error) {
      checks.tablesReachable = true;
      checks.latestSnapshotAt = snapshots.data?.[0]?.captured_at || null;
      checks.latestObservationAt = observations.data?.[0]?.captured_at || null;
      checks.snapshotCount24h = Number(snapshots.count || 0);
      checks.observationCount24h = Number(observations.count || 0);
    }
  }

  const ageMinutes = checks.latestSnapshotAt ? Math.max(0, (Date.now() - Date.parse(checks.latestSnapshotAt)) / 60_000) : null;
  const healthy = checks.databaseConfigured && checks.tablesReachable && ageMinutes !== null && ageMinutes <= 120;
  return response({
    ok: healthy,
    version: "sports-analytics-health-v1",
    status: healthy ? "healthy" : checks.tablesReachable ? "degraded" : "not-activated",
    checkedAt: new Date().toISOString(),
    ageMinutes: ageMinutes === null ? null : Number(ageMinutes.toFixed(1)),
    checks,
    provider,
    safety: { paperOnly: true, productionProbabilityChanged: false }
  }, healthy ? 200 : 503);
}
