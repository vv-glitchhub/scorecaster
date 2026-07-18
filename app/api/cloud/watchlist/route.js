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
import { syncAlertInbox } from "../../../../lib/alert-inbox-service.js";
import { buildWatchlistState } from "../../../../lib/watchlist-alert-engine.mjs";
import { SPORTS } from "../../../../lib/sports.js";
import { GET as getTopPicks } from "../../top-picks/route.js";

export const dynamic = "force-dynamic";

const SUPPORTED_SPORTS = new Set(SPORTS.flatMap((group) => group.leagues.map((league) => league.key)));
const SELECT = "id,event_id,sport,league,market,selection,home_team,away_team,match,commence_time,added_odds,added_decision,alert_move_percent,alert_before_minutes,active,created_at,updated_at";
const MAX_ITEMS = 50;
const DEFAULT_NOTIFICATION_PREFERENCES = {
  in_app_enabled: true,
  push_enabled: false,
  high_enabled: true,
  medium_enabled: true,
  info_enabled: false,
  kickoff_enabled: true,
  decision_enabled: true,
  price_enabled: true
};

function pickEventId(pick = {}) {
  return cleanText(pick.gameId || pick.eventId || pick.id, 180);
}

function normalizedDecision(pick = {}) {
  const value = cleanText(pick.productDecision || pick.decision, 20).toUpperCase();
  if (value === "PLAY") return "PLAY";
  if (value === "SKIP") return "SKIP";
  if (value === "CAUTION") return "CAUTION";
  return "WATCH";
}

function sameSelection(pick, eventId, selection) {
  return pickEventId(pick) === eventId &&
    cleanText(pick.selection || pick.label, 160).toLowerCase() === selection.toLowerCase();
}

function isMissingTable(error) {
  return error?.code === "42P01" || /does not exist|schema cache/i.test(error?.message || "");
}

function alertAllowed(alert, preferences) {
  if (!preferences.in_app_enabled) return false;
  if (alert.severity === "high" && !preferences.high_enabled) return false;
  if (alert.severity === "medium" && !preferences.medium_enabled) return false;
  if (alert.severity === "info" && !preferences.info_enabled) return false;
  if (alert.type === "kickoff_soon" && !preferences.kickoff_enabled) return false;
  if (alert.type === "decision_changed" && !preferences.decision_enabled) return false;
  if (["price_moved", "below_play_price"].includes(alert.type) && !preferences.price_enabled) return false;
  return true;
}

async function loadNotificationPreferences(auth) {
  const { data, error } = await auth.supabase
    .from("notification_preferences")
    .select("in_app_enabled,push_enabled,high_enabled,medium_enabled,info_enabled,kickoff_enabled,decision_enabled,price_enabled")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) {
    return {
      preferences: DEFAULT_NOTIFICATION_PREFERENCES,
      available: false,
      warning: isMissingTable(error) ? "Notification registry migration is not active" : "Notification preferences could not be loaded"
    };
  }
  return {
    preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(data || {}) },
    available: true,
    warning: null
  };
}

async function requireAuth(request, requestId) {
  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) return { error: jsonResponse({ ok: false, error: auth.error }, auth.status, requestId) };
  return auth;
}

async function loadCurrentPicks(request, sports) {
  if (!sports.length) return [];
  const target = new URL("/api/top-picks", request.url);
  target.searchParams.set("sports", [...new Set(sports)].sort().slice(0, 6).join(","));
  const response = await getTopPicks(new Request(target, { method: "GET" }));
  const payload = await response.json();
  if (!response.ok || payload?.ok !== true) return [];
  return Array.isArray(payload.data) ? payload.data : [];
}

export async function GET(request) {
  const requestId = getRequestId(request);
  const auth = await requireAuth(request, requestId);
  if (auth.error) return auth.error;

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "watchlist_read",
    limit: 60,
    windowSeconds: 60
  });
  if (limited) return limited;

  const [{ data, error }, notificationState] = await Promise.all([
    auth.supabase
      .from("watchlist_items")
      .select(SELECT)
      .eq("user_id", auth.user.id)
      .order("commence_time", { ascending: true })
      .limit(MAX_ITEMS),
    loadNotificationPreferences(auth)
  ]);

  if (error) {
    return jsonResponse({ ok: false, error: publicError(error, "Watchlist could not be loaded") }, 500, requestId);
  }

  const rows = data || [];
  const sports = rows.map((item) => item.sport).filter((sport) => SUPPORTED_SPORTS.has(sport));
  const currentPicks = await loadCurrentPicks(request, sports);
  const state = buildWatchlistState({ items: rows, currentPicks });
  const allowedAlerts = state.alerts.filter((alert) => alertAllowed(alert, notificationState.preferences));
  const generatedAt = new Date().toISOString();
  const inboxResult = await syncAlertInbox(auth.supabase, auth.user.id, allowedAlerts, { now: generatedAt });
  const inbox = {
    available: inboxResult.available === true,
    items: inboxResult.items || [],
    summary: inboxResult.summary || { total: 0, unread: 0, active: 0, high: 0, medium: 0, resolved: 0 },
    warning: inboxResult.warning || (inboxResult.error ? "Alert Inbox could not be synchronized" : null)
  };

  return jsonResponse({
    ok: true,
    source: "watchlist-alerts-v2+alert-inbox-v1+notification-preferences-v1",
    paperOnly: true,
    generatedAt,
    notificationPreferences: {
      available: notificationState.available,
      warning: notificationState.warning,
      values: notificationState.preferences
    },
    inbox,
    ...state
  }, 200, requestId);
}

export async function POST(request) {
  const requestId = getRequestId(request);
  if (!mutationOriginAllowed(request)) {
    return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
  }

  const auth = await requireAuth(request, requestId);
  if (auth.error) return auth.error;

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "watchlist_write",
    limit: 20,
    windowSeconds: 60
  });
  if (limited) return limited;

  const body = await readJsonBody(request, 12 * 1024);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);

  const eventId = cleanText(body.data?.eventId, 180);
  const selection = cleanText(body.data?.selection, 160);
  const sport = cleanText(body.data?.sport, 120);
  const alertMovePercent = boundedNumber(body.data?.alertMovePercent, { min: 0.005, max: 0.5, fallback: 0.05 });
  const alertBeforeMinutes = boundedNumber(body.data?.alertBeforeMinutes, { min: 15, max: 10080, fallback: 120 });

  if (!eventId || !selection || !SUPPORTED_SPORTS.has(sport)) {
    return jsonResponse({ ok: false, error: "A supported live fixture and selection are required" }, 400, requestId);
  }

  const currentPicks = await loadCurrentPicks(request, [sport]);
  const pick = currentPicks.find((item) => sameSelection(item, eventId, selection));
  if (!pick) {
    return jsonResponse({ ok: false, error: "The selection is not present in the current verified live-provider analysis" }, 409, requestId);
  }

  const commenceTime = new Date(pick.commenceTime || pick.commence_time || "");
  const odds = boundedNumber(pick.odds, { min: 1.001, max: 10000 });
  if (Number.isNaN(commenceTime.getTime()) || odds === null) {
    return jsonResponse({ ok: false, error: "The verified fixture is missing a valid kickoff or price" }, 409, requestId);
  }

  const row = {
    user_id: auth.user.id,
    event_id: pickEventId(pick),
    sport,
    league: cleanText(pick.league || pick.leagueTitle, 120),
    market: cleanText(pick.marketKey || pick.market, 80, "h2h"),
    selection: cleanText(pick.selection || pick.label, 160),
    home_team: cleanText(pick.homeTeam, 160),
    away_team: cleanText(pick.awayTeam, 160),
    match: cleanText(pick.match || [pick.homeTeam, pick.awayTeam].filter(Boolean).join(" – "), 240),
    commence_time: commenceTime.toISOString(),
    added_odds: odds,
    added_decision: normalizedDecision(pick),
    alert_move_percent: alertMovePercent,
    alert_before_minutes: Math.round(alertBeforeMinutes),
    active: true,
    raw_pick: {
      source: "scorecaster-live-provider-watchlist",
      consensusProbability: boundedNumber(pick.consensusProbability ?? pick.modelProbability, { min: 0, max: 1 }),
      edge: boundedNumber(pick.edge, { min: -1, max: 1 }),
      confidence: boundedNumber(pick.confidence, { min: 0, max: 1 }),
      trustScore: boundedNumber(pick.trustScore, { min: 0, max: 100 })
    }
  };

  const { data, error } = await auth.supabase
    .from("watchlist_items")
    .upsert(row, { onConflict: "user_id,event_id,market,selection" })
    .select(SELECT)
    .single();

  if (error) {
    return jsonResponse({ ok: false, error: publicError(error, "Watchlist item could not be saved") }, 500, requestId);
  }

  return jsonResponse({ ok: true, data }, 200, requestId);
}

export async function PATCH(request) {
  const requestId = getRequestId(request);
  if (!mutationOriginAllowed(request)) {
    return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
  }

  const auth = await requireAuth(request, requestId);
  if (auth.error) return auth.error;
  const limited = await enforceRateLimit(auth, requestId, { bucket: "watchlist_write", limit: 20, windowSeconds: 60 });
  if (limited) return limited;

  const body = await readJsonBody(request, 8 * 1024);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);

  const id = cleanText(body.data?.id, 80);
  const alertMovePercent = boundedNumber(body.data?.alertMovePercent, { min: 0.005, max: 0.5 });
  const alertBeforeMinutes = boundedNumber(body.data?.alertBeforeMinutes, { min: 15, max: 10080 });
  const active = typeof body.data?.active === "boolean" ? body.data.active : null;
  if (!id || (alertMovePercent === null && alertBeforeMinutes === null && active === null)) {
    return jsonResponse({ ok: false, error: "No valid watchlist update supplied" }, 400, requestId);
  }

  const changes = {};
  if (alertMovePercent !== null) changes.alert_move_percent = alertMovePercent;
  if (alertBeforeMinutes !== null) changes.alert_before_minutes = Math.round(alertBeforeMinutes);
  if (active !== null) changes.active = active;

  const { data, error } = await auth.supabase
    .from("watchlist_items")
    .update(changes)
    .eq("user_id", auth.user.id)
    .eq("id", id)
    .select(SELECT)
    .maybeSingle();

  if (error) return jsonResponse({ ok: false, error: publicError(error, "Watchlist settings could not be updated") }, 500, requestId);
  if (!data) return jsonResponse({ ok: false, error: "Watchlist item not found" }, 404, requestId);
  return jsonResponse({ ok: true, data }, 200, requestId);
}

export async function DELETE(request) {
  const requestId = getRequestId(request);
  if (!mutationOriginAllowed(request)) {
    return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
  }

  const auth = await requireAuth(request, requestId);
  if (auth.error) return auth.error;
  const limited = await enforceRateLimit(auth, requestId, { bucket: "watchlist_write", limit: 20, windowSeconds: 60 });
  if (limited) return limited;

  const body = await readJsonBody(request, 4 * 1024);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);
  const id = cleanText(body.data?.id, 80);
  if (!id) return jsonResponse({ ok: false, error: "Watchlist item ID is required" }, 400, requestId);

  const { error } = await auth.supabase
    .from("watchlist_items")
    .delete()
    .eq("user_id", auth.user.id)
    .eq("id", id);

  if (error) return jsonResponse({ ok: false, error: publicError(error, "Watchlist item could not be removed") }, 500, requestId);
  return jsonResponse({ ok: true }, 200, requestId);
}
