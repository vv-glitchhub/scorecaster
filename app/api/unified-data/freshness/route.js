import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { isSupabaseServiceRestricted, restrictedSupabaseResponse } from "../../../../lib/supabase-service-restriction.mjs";
import {
  evaluateUnifiedCaptureFreshness,
  UNIFIED_CAPTURE_FRESHNESS_MINUTES
} from "../../../../lib/unified-capture-freshness-v1.mjs";

export const dynamic = "force-dynamic";

const HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff"
};

function response(payload, status = 200) {
  return Response.json(payload, { status, headers: HEADERS });
}

export async function GET() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return response({
      ok: false,
      error: "Unified Data freshness is unavailable",
      errorCode: "supabase-admin-unconfigured",
      protectedWorkerRequired: true,
      paperOnly: true
    }, 503);
  }

  try {
    const { data, error } = await admin
      .from("unified_data_snapshots")
      .select("captured_at")
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      if (isSupabaseServiceRestricted(error)) return response({ ...restrictedSupabaseResponse("Unified Data freshness"), fresh: false, captureBlocked: true, protectedWorkerRequired: false }, 503);
      return response({ ok: false, error: "Unified Data freshness is unavailable", errorCode: "snapshot-query-failed", protectedWorkerRequired: true, paperOnly: true }, 503);
    }

    const freshness = evaluateUnifiedCaptureFreshness({
      latestCapturedAt: data?.captured_at || null,
      now: Date.now(),
      thresholdMinutes: UNIFIED_CAPTURE_FRESHNESS_MINUTES
    });

    return response({
      ok: true,
      version: freshness.version,
      fresh: freshness.fresh,
      latestCapturedAt: freshness.latestCapturedAt,
      ageMinutes: freshness.ageMinutes,
      thresholdMinutes: freshness.thresholdMinutes,
      protectedWorkerRequired: freshness.protectedWorkerRequired,
      paperOnly: true
    });
  } catch (error) {
    if (isSupabaseServiceRestricted(error)) return response({ ...restrictedSupabaseResponse("Unified Data freshness"), fresh: false, captureBlocked: true, protectedWorkerRequired: false }, 503);
    return response({
      ok: false,
      error: "Unified Data freshness is unavailable",
      errorCode: "snapshot-query-failed",
      protectedWorkerRequired: true,
      paperOnly: true
    }, 503);
  }
}
