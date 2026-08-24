import {
  boundedNumber,
  cleanText,
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
  selection_mode: "play-and-caution",
  min_score: 0,
  min_edge: 0,
  min_ev: 0,
  sport_keys: [],
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

function normalizeSportKeys(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map((item) => cleanText(item, 120).toLowerCase())
    .filter((item) => /^[a-z0-9_:-]+$/.test(item)))]
    .slice(0, 20);
}

async function loadPreferences(auth) {
  const { data, error } = await auth.supabase
    .from("auto_watch_recommendation_preferences")
    .select("enabled,top_n,alert_move_percent,alert_before_minutes,selection_mode,min_score,min_edge,min_ev,sport_keys,next_sync_at,last_started_at,last_completed_at,last_status,last_error,last_synced_count,last_removed_count,created_at,updated_at")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) return { data: null, error };
  return { data: { ...DEFAULTS, ...(data || {}), sport_keys: Array.isArray(data?.sport_keys) ? data.sport_keys : [] }, error: null };
}

async function currentRecommendations(request) {
  const target = new URL("/api/recommendations", request.url);
  target.searchParams.set("limit", "20");
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
    return jsonResponse({ ok: true, available: false, version: 1, preferences: DEFAULTS, paperOnly: true }, 200, requestId);
  }
  if (preferences.error) {
    return jsonResponse({ ok: false, error: publicError(preferences.error, "Auto-Watch preferences could not be loaded") }, 500, requestId);
  }

  const { data: rows, error: rowsError } = await auth.supabase
    .from("watchlist_items")
    .select("id,raw_pick")
    .eq("user_id", auth.user.id)
    .contains("raw_pick", { source: "scorecaster-auto-watch-recommendations-v1" })
    .limit(10);

  return jsonResponse({
    ok: true,
    available: true,
    version: 2,
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

  const body = await readJsonBody(request, 12 * 1024);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);

  const enabled = body.data?.enabled === true;
  const topN = boundedNumber(body.data?.topN, { min: 1, max: 10, fallback: 3 });
  const alertMovePercent = boundedNumber(body.data?.alertMovePercent, { min: 0.005, max: 0.5, fallback: 0.03 });
  const alertBeforeMinutes = boundedNumber(body.data?.alertBeforeMinutes, { min: 15, max: 10080, fallback: 120 });
  const selectionMode = cleanText(body.data?.selectionMode, 40) === "play-only" ? "play-only" : "play-and-caution";
  const minScore = boundedNumber(body.data?.minScore, { min: 0, max: 100, fallback: 0 });
  const minEdge = boundedNumber(body.data?.minEdge, { min: 0, max: 0.20, fallback: 0 });
  const minEv = boundedNumber(body.data?.minEv, { min: 0, max: 1, fallback: 0 });
  const requestedSports = Array.isArray(body.data?.sportKeys) ? body.data.sportKeys : [];
  const sportKeys = normalizeSportKeys(requestedSports);
  if (sportKeys.length !== new Set(requestedSports.map((item) => cleanText(item, 120).toLowerCase()).filter(Boolean)).size && requestedSports.length > 0) {
    return jsonResponse({ ok: false, error: "Invalid Auto-Watch sport filters" }, 400, requestId);
  }
  if (![topN, alertMovePercent, alertBeforeMinutes, minScore, minEdge, minEv].every((value) => value !== null)) {
    return jsonResponse({ ok: false, error: "Invalid Auto-Watch settings" }, 400, requestId);
  }

  const { data: saved, error: saveError } = await auth.supabase.rpc("set_auto_watch_recommendation_preferences_v2", {
    p_enabled: enabled,
    p_top_n: Math.trunc(topN),
    p_alert_move_percent: alertMovePercent,
    p_alert_before_minutes: Math.trunc(alertBeforeMinutes),
    p_selection_mode: selectionMode,
    p_min_score: minScore,
    p_min_edge: minEdge,
    p_min_ev: minEv,
    p_sport_keys: sportKeys
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
    } catch {
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
        alert_before_minutes: Math.trunc(alertBeforeMinutes),
        selection_mode: selectionMode,
        min_score: minScore,
        min_edge: minEdge,
        min_ev: minEv,
        sport_keys: sportKeys
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
    version: 2,
    paperOnly: true,
    realMoneyActionAvailable: false,
    preferences: preferences.error ? { ...DEFAULTS, ...(saved || {}) } : preferences.data,
    sync,
    warning: recommendationWarning
  }, 200, requestId);
}
