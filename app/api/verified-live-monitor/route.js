import { getSupabaseAdmin } from "../../../lib/supabase-admin";
import { buildVerifiedLiveMonitor } from "../../../lib/verified-live-monitor-v1.mjs";

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
const clean = (value, maximum = 180) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);

function missingPatch(error) {
  return error?.code === "42P01" || /live_event_snapshots_v1|does not exist|schema cache/i.test(String(error?.message || error || ""));
}

export async function GET(request) {
  const url = new URL(request.url);
  const unknown = [...url.searchParams.keys()].filter((key) => key !== "eventId");
  const eventId = clean(url.searchParams.get("eventId"), 180);
  if (unknown.length || !eventId) {
    return Response.json({ ok: false, error: "eventId is required", paperOnly: true }, { status: 400, headers: HEADERS });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return Response.json({ ok: false, error: "Live monitor database is not configured", paperOnly: true }, { status: 503, headers: { ...HEADERS, "Cache-Control": "no-store" } });
  }

  try {
    const since = new Date(Date.now() - 12 * 3600000).toISOString();
    const { data, error } = await admin
      .from("live_event_snapshots_v1")
      .select("id,event_id,sport,league,market,provider_id,source_id,status,period,clock_seconds,clock_direction,home_team,away_team,home_score,away_score,commence_time,observed_at,provider_updated_at,captured_at,correction,correction_reason,supersedes_id,metrics,prices,live_probabilities,live_model_version")
      .eq("event_id", eventId)
      .gte("observed_at", since)
      .order("observed_at", { ascending: true })
      .limit(5000);
    if (error) throw error;

    const monitor = buildVerifiedLiveMonitor({
      eventId,
      generatedAt: new Date().toISOString(),
      snapshots: data || []
    });
    return Response.json({
      ...monitor,
      rawProviderPayloadReturned: false,
      apiKeysReturned: false,
      userDataReturned: false
    }, { headers: HEADERS });
  } catch (error) {
    return Response.json({
      ok: false,
      error: missingPatch(error) ? "Verified Live Monitor production patch is not active" : "Verified live evidence could not be loaded",
      requiredPatch: missingPatch(error) ? "scripts/apply-verified-live-monitor-v1.sql" : undefined,
      paperOnly: true
    }, { status: missingPatch(error) ? 503 : 500, headers: { ...HEADERS, "Cache-Control": "no-store" } });
  }
}
