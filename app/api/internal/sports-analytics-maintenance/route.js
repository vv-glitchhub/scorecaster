import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

function response(payload, status = 200) {
  return Response.json(payload, { status, headers: HEADERS });
}

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

function integer(value, fallback, min, max) {
  const number = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

export async function GET(request) {
  if (!process.env.CRON_SECRET) return response({ ok: false, error: "Sports analytics cron secret is not configured" }, 503);
  if (!authorized(request)) return response({ ok: false, error: "Unauthorized" }, 401);
  const admin = getSupabaseAdmin();
  if (!admin) return response({ ok: false, error: "Supabase admin client is not configured" }, 503);

  const url = new URL(request.url);
  const retentionDays = integer(url.searchParams.get("retentionDays"), 180, 30, 730);
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [oldObservationCount, oldSnapshotCount] = await Promise.all([
      admin.from("sports_analytics_observations").select("id", { count: "exact", head: true }).lt("captured_at", cutoff),
      admin.from("sports_analytics_snapshots").select("id", { count: "exact", head: true }).lt("captured_at", cutoff)
    ]);
    if (oldObservationCount.error) throw oldObservationCount.error;
    if (oldSnapshotCount.error) throw oldSnapshotCount.error;

    const [observationDelete, snapshotDelete] = await Promise.all([
      admin.from("sports_analytics_observations").delete().lt("captured_at", cutoff),
      admin.from("sports_analytics_snapshots").delete().lt("captured_at", cutoff)
    ]);
    if (observationDelete.error) throw observationDelete.error;
    if (snapshotDelete.error) throw snapshotDelete.error;

    return response({
      ok: true,
      version: "sports-analytics-maintenance-v1",
      completedAt: new Date().toISOString(),
      retentionDays,
      cutoff,
      deletedObservations: Number(oldObservationCount.count || 0),
      deletedSnapshots: Number(oldSnapshotCount.count || 0),
      paperOnly: true,
      probabilityChanged: false
    });
  } catch (error) {
    return response({
      ok: false,
      error: process.env.NODE_ENV === "production" ? "Sports analytics maintenance failed" : String(error),
      retentionDays,
      cutoff
    }, 500);
  }
}
