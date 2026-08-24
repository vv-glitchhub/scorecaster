import {
  boundedNumber,
  enforceRateLimit,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse,
  mutationOriginAllowed,
  publicError,
  readJsonBody
} from "../../../../lib/api-security";
import { syncAutoWatchRecommendations } from "../../../../lib/auto-watch-recommendation-service.js";
import { GET as getRecommendations } from "../../recommendations/route.js";

export const dynamic = "force-dynamic";

const DEFAULTS = {
  enabled: false,
  top_n: 3,
  alert_move_percent: 0.03,
  alert_before_minutes: 120,
  next_sync_at: null,
  last_completed_at: null,
  last_status: "idle",
  last_error: null,
  last_synced_count: 0,
  last_removed_count: 0
};

function missingRegistry(error) {
  return error?.code === "42P01" || error?.code === "42883" || /does not exist|schema cache/i.test(error?.message || "");
}

async function loadPreferences(auth) {
  const { data, error } = await auth.supabase
    .from("auto_watch_recommendation_preferences")
    .select("enabled,top_n,alert_move_percent,alert_before_minutes,next_sync_at,last_started_at,last_completed_at,last_status,last_error,last_synced_count,last_removed_count,created_at,updated_at")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) return { data: null, error };
  return { data: { ...DEFAULTS, ...(data || {}) }, error: null };
}

async function currentRecommendations(request) {
  const target = new URL("/api/recommendations", request.url);
  target.searchParams.set("limit", "3");
  const response = await getRecommendations(new Request(target, { method: "GET" }));
  const payload = await response.json();
  if (!response.ok || payload?.ok !== true || !Array.isArray(payload.recommendations)) {
    throw new Error(payload?.error || "Recommendation feed unavailable");
  }
  return payload.recommendations;
}

export async function GET(request) {
  const requestId = getRequestId(request);
  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, requestId);

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "auto_watch_read",
    limit: 60,
    windowSeconds: 60
  });
  if (limited) return limited;

  const preferences = await loadPreferences(auth);
  if (preferences.error && missingRegistry(preferences.error)) {
    return jsonResponse({ ok: true, available: false, preferences: DEFAULTS, paperOnly: true }, 200, requestId);
  }
  if (preferences.error) {
    return jsonResponse({ ok: false, error: publicError(preferences.error, "Auto-Watch preferences could not be loaded") }, 500, requestId);
  }

  const { data: rows, error: rowsError } = await auth.supabase
    .from("watchlist_items")
    .select("id,raw_pick")
    .eq("user_id", auth.user.id)
    .contains("raw_pick", { source: "scorecaster-auto-watch-recommendations-v1" })
    .limit(3);

  return jsonResponse({
    ok: true,
    available: true,
    paperOnly: true,
    realMoneyActionAvailable: false,
    preferences: preferences.data,
    autoManagedCount: rowsError ? null : (rows || []).length
  }, 200, requestId);
}

export async function PATCH(request) {
  const requestId = getRequestId(request);
  if (!mutationOriginAllowed(request)) {
    return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
  }

  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, requestId);

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "auto_watch_write",
    limit: 20,
    windowSeconds: 60
  });
  if (limited) return limited;

  const body = await readJsonBody(request, 8 * 1024);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);

  const enabled = body.data?.enabled === true;
  const topN = boundedNumber(body.data?.topN, { min: 1, max: 3, fallback: 3 });
  const alertMovePercent = boundedNumber(body.data?.alertMovePercent, { min: 0.005, max: 0.5, fallback: 0.03 });
  const alertBeforeMinutes = boundedNumber(body.data?.alertBeforeMinutes, { min: 15, max: 10080, fallback: 120 });
  if (![topN, alertMovePercent, alertBeforeMinutes].every((value) => value !== null)) {
    return jsonResponse({ ok: false, error: "Invalid Auto-Watch settings" }, 400, requestId);
  }

  const { data: saved, error: saveError } = await auth.supabase.rpc("set_auto_watch_recommendation_preferences", {
    p_enabled: enabled,
    p_top_n: Math.trunc(topN),
    p_alert_move_percent: alertMovePercent,
    p_alert_before_minutes: Math.trunc(alertBeforeMinutes)
  });
  if (saveError) {
    const status = missingRegistry(saveError) ? 503 : 500;
    return jsonResponse({ ok: false, error: publicError(saveError, "Auto-Watch settings could not be saved") }, status, requestId);
  }

  let recommendations = [];
  let recommendationWarning = null;
  if (enabled) {
    try {
      recommendations = await currentRecommendations(request);
    } catch (error) {
      recommendationWarning = "Auto-Watch was enabled, but the current recommendation feed could not be synchronized immediately";
    }
  }

  let sync;
  try {
    sync = await syncAutoWatchRecommendations({
      client: auth.supabase,
      userId: auth.user.id,
      recommendations,
      preferences: {
        enabled,
        top_n: Math.trunc(topN),
        alert_move_percent: alertMovePercent,
        alert_before_minutes: Math.trunc(alertBeforeMinutes)
      }
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: publicError(error, "Auto-Watch settings were saved but watchlist synchronization failed")
    }, 500, requestId);
  }

  const preferences = await loadPreferences(auth);
  return jsonResponse({
    ok: true,
    available: true,
    paperOnly: true,
    realMoneyActionAvailable: false,
    preferences: preferences.error ? { ...DEFAULTS, ...(saved || {}) } : preferences.data,
    sync,
    warning: recommendationWarning
  }, 200, requestId);
}
