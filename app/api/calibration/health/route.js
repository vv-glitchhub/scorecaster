import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { resolveCalibrationSettlementActivation } from "../../../../lib/calibration-settlement-activation.mjs";

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=180", "X-Content-Type-Options": "nosniff" };
const json = (body, status = 200) => Response.json(body, { status, headers: HEADERS });

function missingPatch(error) {
  return error?.code === "42P01" || /calibration_(observations|settlement_runs)_v1|does not exist|schema cache/i.test(String(error?.message || error || ""));
}

export async function GET() {
  const activation = resolveCalibrationSettlementActivation();
  const workerEnabled = activation.enabled;
  const admin = getSupabaseAdmin();
  if (!admin) return json({
    ok: false,
    status: "database-unconfigured",
    workerEnabled,
    activationMode: activation.mode,
    emergencyStopAvailable: activation.emergencyStopAvailable,
    paperOnly: true
  }, 503);

  try {
    const [{ data: latestRun, error: runError }, { count: observations, error: countError }, { count: exclusions, error: exclusionError }] = await Promise.all([
      admin
        .from("calibration_settlement_runs_v1")
        .select("id,started_at,completed_at,status,settled_bets_seen,observations_written,exclusions_written,duplicate_count")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin.from("calibration_observations_v1").select("id", { count: "exact", head: true }).is("exclusion_reason", null),
      admin.from("calibration_observations_v1").select("id", { count: "exact", head: true }).not("exclusion_reason", "is", null)
    ]);
    if (runError) throw runError;
    if (countError) throw countError;
    if (exclusionError) throw exclusionError;

    const completedAt = latestRun?.completed_at || latestRun?.started_at || null;
    const ageHours = completedAt ? Math.max(0, (Date.now() - Date.parse(completedAt)) / 3600000) : null;
    const status = !workerEnabled
      ? "worker-disabled"
      : !latestRun
        ? "awaiting-first-run"
        : ["success", "partial"].includes(latestRun.status) && ageHours <= 24
          ? "healthy"
          : ageHours > 24
            ? "stale"
            : "degraded";

    return json({
      ok: ["healthy", "worker-disabled", "awaiting-first-run"].includes(status),
      version: "scorecaster-calibration-health-v1",
      status,
      storageAvailable: true,
      workerEnabled,
      activationMode: activation.mode,
      emergencyStopAvailable: activation.emergencyStopAvailable,
      repositoryDefaultEnabled: activation.repositoryDefault,
      eligibleObservationCount: observations || 0,
      exclusionCount: exclusions || 0,
      latestRun: latestRun ? { ...latestRun, ageHours: Number((ageHours || 0).toFixed(2)) } : null,
      closingSource: "market-microstructure-v2-final-prestart-consensus",
      currentOddsFallbackUsed: false,
      simulatedClosingUsed: false,
      automaticModelPromotion: false,
      personalDataExposed: false,
      secretsExposed: false,
      paperOnly: true
    }, status === "degraded" ? 503 : 200);
  } catch (error) {
    return json({
      ok: false,
      status: missingPatch(error) ? "production-patch-missing" : "health-check-failed",
      requiredPatch: missingPatch(error) ? "scripts/apply-calibration-lab-v1.sql" : undefined,
      workerEnabled,
      activationMode: activation.mode,
      emergencyStopAvailable: activation.emergencyStopAvailable,
      personalDataExposed: false,
      paperOnly: true
    }, 503);
  }
}
