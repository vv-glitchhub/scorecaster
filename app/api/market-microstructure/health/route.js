import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { getCollectorSource, sourceCanCollect } from "../../../../lib/collector-source-registry.mjs";

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=180", "X-Content-Type-Options": "nosniff" };
const json = (body, status = 200) => Response.json(body, { status, headers: HEADERS });

function missingPatch(error) {
  return error?.code === "42P01" || /market_(capture_runs|provider_snapshots)_v2|does not exist|schema cache/i.test(String(error?.message || error || ""));
}

export async function GET() {
  const source = getCollectorSource("the_odds_api");
  const permission = sourceCanCollect(source, { production: process.env.NODE_ENV === "production" });
  const workerEnabled = ["1", "true", "yes", "on"].includes(String(process.env.MARKET_MICROSTRUCTURE_ENABLED || "").toLowerCase());
  const admin = getSupabaseAdmin();
  if (!admin) {
    return json({
      ok: false,
      status: "database-unconfigured",
      storageAvailable: false,
      workerEnabled,
      sourceAllowed: permission.allowed,
      sourceReason: permission.reason,
      paperOnly: true
    }, 503);
  }

  try {
    const now = new Date().toISOString();
    const [{ data: latestRun, error: runError }, { count: upcomingRecords, error: countError }] = await Promise.all([
      admin
        .from("market_capture_runs_v2")
        .select("id,started_at,completed_at,status,source_id,league_count,event_count,record_count,rejected_count,duplicate_count")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("market_provider_snapshots_v2")
        .select("id", { count: "exact", head: true })
        .gt("commence_time", now)
    ]);
    if (runError) throw runError;
    if (countError) throw countError;

    const latestCompleted = latestRun?.completed_at || latestRun?.started_at || null;
    const ageMinutes = latestCompleted ? Math.max(0, (Date.now() - Date.parse(latestCompleted)) / 60000) : null;
    const healthyRun = latestRun?.status === "success" || latestRun?.status === "partial";
    const freshRun = ageMinutes !== null && ageMinutes <= 90;
    const status = !workerEnabled
      ? "worker-disabled"
      : !permission.allowed
        ? "source-blocked"
        : !latestRun
          ? "awaiting-first-run"
          : healthyRun && freshRun
            ? "healthy"
            : ageMinutes !== null && !freshRun
              ? "stale"
              : "degraded";

    return json({
      ok: ["healthy", "worker-disabled", "awaiting-first-run"].includes(status),
      version: "scorecaster-market-microstructure-health-v2",
      status,
      storageAvailable: true,
      workerEnabled,
      sourceAllowed: permission.allowed,
      sourceReason: permission.reason,
      sourceId: "the_odds_api",
      sourceAttribution: source?.attribution || "Market odds: The Odds API",
      upcomingNormalizedRecords: upcomingRecords || 0,
      latestRun: latestRun ? { ...latestRun, ageMinutes: ageMinutes === null ? null : Number(ageMinutes.toFixed(1)) } : null,
      secretsExposed: false,
      rawPayloadPublic: false,
      realMoneyExecution: false,
      paperOnly: true
    }, status === "source-blocked" || status === "degraded" ? 503 : 200);
  } catch (error) {
    return json({
      ok: false,
      status: missingPatch(error) ? "production-patch-missing" : "health-check-failed",
      storageAvailable: false,
      requiredPatch: missingPatch(error) ? "scripts/apply-market-microstructure-v2.sql" : undefined,
      workerEnabled,
      sourceAllowed: permission.allowed,
      secretsExposed: false,
      paperOnly: true
    }, 503);
  }
}
