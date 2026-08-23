import { getSupabaseAdmin } from "../../../lib/supabase-admin";
import { resolveMarketMicrostructureActivation } from "../../../lib/market-microstructure-activation.mjs";
import { liveMonitorProviderConfiguration } from "../../../lib/live-monitor-json-provider";
import { buildProviderAcquisitionPlan } from "../../../lib/provider-acquisition-v1.mjs";
import { buildDataReadiness } from "../../../lib/data-readiness-v1.mjs";

export const dynamic = "force-dynamic";

const HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=180",
  "X-Content-Type-Options": "nosniff"
};

function safe(result) {
  return result?.error ? null : result?.data ?? null;
}

function count(result) {
  return result?.error ? 0 : result?.count || 0;
}

export async function GET() {
  const admin = getSupabaseAdmin();
  const provider = liveMonitorProviderConfiguration();
  const activation = resolveMarketMicrostructureActivation();
  const acquisition = buildProviderAcquisitionPlan();

  if (!admin) {
    return Response.json({
      ok: false,
      status: "database-unconfigured",
      data: buildDataReadiness({
        acquisition,
        marketCapture: { workerEnabled: activation.enabled },
        liveMonitor: { provider },
        shadowLearning: {}
      }),
      paperOnly: true
    }, { status: 503, headers: { ...HEADERS, "Cache-Control": "no-store" } });
  }

  const since = new Date(Date.now() - 24 * 3600000).toISOString();
  const [captureRun, captureSnapshots, liveRun, liveSnapshots, liveLatest, shadowSettled, shadowClv, shadowReady, shadowCycle] = await Promise.all([
    admin.from("market_capture_runs_v2")
      .select("id,status,source_id,league_count,event_count,record_count,rejected_count,duplicate_count,started_at,completed_at")
      .order("started_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("market_provider_snapshots_v2").select("id", { count: "exact", head: true }),
    admin.from("live_monitor_runs_v1")
      .select("status,event_count,received_count,accepted_count,rejected_count,alert_count,started_at,completed_at")
      .order("started_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("live_event_snapshots_v1").select("id", { count: "exact", head: true }).gte("captured_at", since),
    admin.from("live_event_snapshots_v1")
      .select("provider_id,source_id,status,provider_updated_at,captured_at")
      .order("captured_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("shadow_learning_samples").select("id", { count: "exact", head: true }).eq("settlement_status", "settled"),
    admin.from("shadow_learning_samples").select("id", { count: "exact", head: true }).eq("settlement_status", "settled").not("clv", "is", null),
    admin.from("shadow_learning_state").select("user_id", { count: "exact", head: true }).eq("review_ready", true),
    admin.from("shadow_learning_cycles")
      .select("status,sample_size,clv_sample,created_at")
      .order("created_at", { ascending: false }).limit(1).maybeSingle()
  ]);

  const queryErrors = [captureRun, captureSnapshots, liveRun, liveSnapshots, liveLatest, shadowSettled, shadowClv, shadowReady, shadowCycle]
    .filter((result) => result?.error)
    .map((result) => ({ code: result.error.code || null, message: "Readiness source unavailable" }));
  const data = buildDataReadiness({
    acquisition,
    marketCapture: {
      workerEnabled: activation.enabled,
      latestRun: safe(captureRun),
      snapshotCount: count(captureSnapshots)
    },
    liveMonitor: {
      provider,
      latestRun: safe(liveRun),
      snapshots24h: count(liveSnapshots),
      latestSnapshot: safe(liveLatest)
    },
    shadowLearning: {
      settledCount: count(shadowSettled),
      clvCount: count(shadowClv),
      reviewReadyCount: count(shadowReady),
      latestCycle: safe(shadowCycle)
    }
  });

  return Response.json({
    ok: true,
    status: queryErrors.length ? "partial" : "ready",
    data,
    unavailableSourceCount: queryErrors.length,
    personalDataReturned: false,
    secretsReturned: false,
    paperOnly: true
  }, { headers: HEADERS });
}
