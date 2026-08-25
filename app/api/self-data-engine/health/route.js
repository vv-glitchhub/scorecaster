import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { SELF_DATA_ENGINE_VERSION, PIT_FEATURE_SCHEMA_VERSION } from "../../../../lib/self-data-engine-v1.mjs";

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export async function GET() {
  const admin = getSupabaseAdmin();
  if (!admin) return Response.json({ ok: false, error: "Supabase admin client is not configured" }, { status: 503, headers: HEADERS });

  try {
    const [runResult, featureCount, decisionCount] = await Promise.all([
      admin
        .from("scorecaster_data_engine_runs_v1")
        .select("id,started_at,completed_at,status,events_seen,feature_snapshots,decisions_written,source_status,errors")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin.from("scorecaster_pit_feature_snapshots_v1").select("id", { count: "exact", head: true }),
      admin.from("scorecaster_autonomous_decisions_v1").select("id", { count: "exact", head: true }),
    ]);

    if (runResult.error) throw runResult.error;
    if (featureCount.error) throw featureCount.error;
    if (decisionCount.error) throw decisionCount.error;

    const lastRun = runResult.data || null;
    return Response.json({
      ok: true,
      version: SELF_DATA_ENGINE_VERSION,
      featureSchemaVersion: PIT_FEATURE_SCHEMA_VERSION,
      mode: "autonomous-paper-intelligence",
      architecture: {
        collection: "rights-aware",
        storage: "immutable-point-in-time",
        featureMaterialization: true,
        modelDecisions: true,
        chronologyGuard: true,
        provenanceRequired: true,
        missingDataBehavior: "fail-closed",
      },
      totals: {
        featureSnapshots: featureCount.count || 0,
        decisionSnapshots: decisionCount.count || 0,
      },
      lastRun,
      automaticUpgradeBySelfDataLayer: false,
      productionProbabilityChanged: false,
      wagerExecutionAvailable: false,
      paperOnly: true,
    }, { headers: HEADERS });
  } catch (error) {
    return Response.json({
      ok: false,
      version: SELF_DATA_ENGINE_VERSION,
      error: process.env.NODE_ENV === "production" ? "Self data engine health unavailable" : String(error),
      paperOnly: true,
    }, { status: 503, headers: HEADERS });
  }
}
