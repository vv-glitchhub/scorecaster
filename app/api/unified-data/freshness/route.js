import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import {
  evaluateUnifiedCaptureFreshness,
  UNIFIED_CAPTURE_FRESHNESS_MINUTES
} from "../../../../lib/unified-capture-freshness-v1.mjs";

export const dynamic = "force-dynamic";

const HEADERS = {
  "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
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
    if (error) throw error;

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
  } catch {
    return response({
      ok: false,
      error: "Unified Data freshness is unavailable",
      paperOnly: true
    }, 503);
  }
}
