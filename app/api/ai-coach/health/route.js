import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

function missingPatch(error) {
  return error?.code === "42P01" || /ai_coach_|does not exist|schema cache/i.test(String(error?.message || error || ""));
}

export async function GET() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return Response.json({
      ok: false,
      version: "scorecaster-ai-coach-v1",
      status: "database-unconfigured",
      paperOnly: true
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const [{ count: preferenceCount, error: preferenceError }, { count: reportCount, error: reportError }, { data: latest, error: latestError }] = await Promise.all([
      admin.from("ai_coach_preferences_v1").select("user_id", { count: "exact", head: true }),
      admin.from("ai_coach_reports_v1").select("id", { count: "exact", head: true }),
      admin.from("ai_coach_reports_v1").select("generated_at,report_version,evidence_count").order("generated_at", { ascending: false }).limit(1).maybeSingle()
    ]);
    if (preferenceError) throw preferenceError;
    if (reportError) throw reportError;
    if (latestError) throw latestError;

    return Response.json({
      ok: true,
      version: "scorecaster-ai-coach-v1",
      status: "ready",
      preferenceRows: preferenceCount || 0,
      reportRows: reportCount || 0,
      latestReport: latest ? {
        generatedAt: latest.generated_at,
        reportVersion: latest.report_version,
        evidenceCount: latest.evidence_count
      } : null,
      userIdentifiersReturned: false,
      reportPayloadReturned: false,
      notificationsAreBounded: true,
      modelProbabilityChanged: false,
      automaticStakeChanged: false,
      realMoneyExecution: false,
      paperOnly: true
    }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    return Response.json({
      ok: false,
      version: "scorecaster-ai-coach-v1",
      status: missingPatch(error) ? "patch-required" : "unavailable",
      requiredPatch: missingPatch(error) ? "scripts/apply-ai-coach-v1.sql" : undefined,
      paperOnly: true
    }, { status: missingPatch(error) ? 503 : 500, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  }
}
