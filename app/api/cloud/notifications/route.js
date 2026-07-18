import {
  cleanText,
  enforceRateLimit,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse,
  mutationOriginAllowed,
  publicError,
  readJsonBody
} from "../../../../lib/api-security";
import {
  buildNotificationCandidates,
  normalizeNotificationSettings,
  summarizeNotifications
} from "../../../../lib/notification-center.mjs";
import { buildWatchlistState } from "../../../../lib/watchlist-alert-engine.mjs";
import { SPORTS } from "../../../../lib/sports.js";
import { GET as getTopPicks } from "../../top-picks/route.js";

export const dynamic = "force-dynamic";

const SUPPORTED_SPORTS = new Set(SPORTS.flatMap((group) => group.leagues.map((league) => league.key)));
const WATCH_SELECT = "id,event_id,sport,league,market,selection,home_team,away_team,match,commence_time,added_odds,added_decision,alert_move_percent,alert_before_minutes,active,created_at,updated_at";
const NOTIFICATION_SELECT = "id,source_key,source_type,notification_type,severity,watchlist_id,event_id,match,selection,commence_time,payload,first_seen_at,last_seen_at,read_at,dismissed_at,created_at,updated_at";
const SETTINGS_SELECT = "in_app_enabled,minimum_severity,kickoff_enabled,price_enabled,decision_enabled,availability_enabled,created_at,updated_at";
const MAX_INBOX = 200;

function defaultSettings() {
  return {
    in_app_enabled: true,
    minimum_severity: "info",
    kickoff_enabled: true,
    price_enabled: true,
    decision_enabled: true,
    availability_enabled: true
  };
}

async function requireAuth(request, requestId) {
  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) return { error: jsonResponse({ ok: false, error: auth.error }, auth.status, requestId) };
  return auth;
}

async function loadSettings(auth) {
  const { data, error } = await auth.supabase
    .from("notification_settings")
    .select(SETTINGS_SELECT)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  return { data: data || defaultSettings(), error };
}

async function loadInbox(auth) {
  const { data, error } = await auth.supabase
    .from("notification_items")
    .select(NOTIFICATION_SELECT)
    .eq("user_id", auth.user.id)
    .is("dismissed_at", null)
    .order("last_seen_at", { ascending: false })
    .limit(MAX_INBOX);
  return { data: data || [], error };
}

async function loadCurrentPicks(request, sports) {
  const supported = [...new Set(sports)].filter((sport) => SUPPORTED_SPORTS.has(sport)).sort().slice(0, 6);
  if (!supported.length) return [];
  const target = new URL("/api/top-picks", request.url);
  target.searchParams.set("sports", supported.join(","));
  const response = await getTopPicks(new Request(target, { method: "GET" }));
  const payload = await response.json();
  if (!response.ok || payload?.ok !== true) return [];
  return Array.isArray(payload.data) ? payload.data : [];
}

async function responsePayload(auth, requestId, extra = {}) {
  const [settingsResult, inboxResult] = await Promise.all([loadSettings(auth), loadInbox(auth)]);
  const error = settingsResult.error || inboxResult.error;
  if (error) {
    return jsonResponse({ ok: false, error: publicError(error, "Notification Center could not be loaded") }, 500, requestId);
  }
  return jsonResponse({
    ok: true,
    source: "notification-center-v1",
    deliveryMode: "in-app-manual-sync",
    pushEnabled: false,
    generatedAt: new Date().toISOString(),
    settings: settingsResult.data,
    items: inboxResult.data,
    summary: summarizeNotifications(inboxResult.data),
    ...extra
  }, 200, requestId);
}

export async function GET(request) {
  const requestId = getRequestId(request);
  const auth = await requireAuth(request, requestId);
  if (auth.error) return auth.error;
  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "notification_read",
    limit: 60,
    windowSeconds: 60
  });
  if (limited) return limited;
  return responsePayload(auth, requestId);
}

export async function POST(request) {
  const requestId = getRequestId(request);
  if (!mutationOriginAllowed(request)) {
    return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
  }
  const auth = await requireAuth(request, requestId);
  if (auth.error) return auth.error;
  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "notification_sync",
    limit: 12,
    windowSeconds: 300
  });
  if (limited) return limited;

  const body = await readJsonBody(request, 4 * 1024);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);
  if (cleanText(body.data?.action, 30) !== "sync") {
    return jsonResponse({ ok: false, error: "Unsupported Notification Center action" }, 400, requestId);
  }

  const [settingsResult, watchlistResult] = await Promise.all([
    loadSettings(auth),
    auth.supabase
      .from("watchlist_items")
      .select(WATCH_SELECT)
      .eq("user_id", auth.user.id)
      .order("commence_time", { ascending: true })
      .limit(50)
  ]);
  const sourceError = settingsResult.error || watchlistResult.error;
  if (sourceError) {
    return jsonResponse({ ok: false, error: publicError(sourceError, "Notification sources could not be loaded") }, 500, requestId);
  }

  const rows = watchlistResult.data || [];
  const currentPicks = await loadCurrentPicks(request, rows.map((item) => item.sport));
  const watchState = buildWatchlistState({ items: rows, currentPicks });
  const candidates = buildNotificationCandidates(watchState.alerts, settingsResult.data);

  if (candidates.length) {
    const records = candidates.map((candidate) => ({ ...candidate, user_id: auth.user.id }));
    const { error } = await auth.supabase
      .from("notification_items")
      .upsert(records, { onConflict: "user_id,source_key" });
    if (error) {
      return jsonResponse({ ok: false, error: publicError(error, "Notifications could not be synchronized") }, 500, requestId);
    }
  }

  const { data: overflow, error: overflowError } = await auth.supabase
    .from("notification_items")
    .select("id")
    .eq("user_id", auth.user.id)
    .order("last_seen_at", { ascending: false })
    .range(MAX_INBOX, MAX_INBOX + 99);
  if (!overflowError && overflow?.length) {
    await auth.supabase
      .from("notification_items")
      .delete()
      .eq("user_id", auth.user.id)
      .in("id", overflow.map((item) => item.id));
  }

  return responsePayload(auth, requestId, {
    synchronized: candidates.length,
    verifiedAlertCount: watchState.alerts.length
  });
}

export async function PUT(request) {
  const requestId = getRequestId(request);
  if (!mutationOriginAllowed(request)) {
    return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
  }
  const auth = await requireAuth(request, requestId);
  if (auth.error) return auth.error;
  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "notification_write",
    limit: 20,
    windowSeconds: 60
  });
  if (limited) return limited;

  const body = await readJsonBody(request, 6 * 1024);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);
  const settings = normalizeNotificationSettings(body.data || {});
  const row = {
    user_id: auth.user.id,
    in_app_enabled: Boolean(settings.inAppEnabled),
    minimum_severity: settings.minimumSeverity,
    kickoff_enabled: Boolean(settings.kickoffEnabled),
    price_enabled: Boolean(settings.priceEnabled),
    decision_enabled: Boolean(settings.decisionEnabled),
    availability_enabled: Boolean(settings.availabilityEnabled)
  };
  const { error } = await auth.supabase
    .from("notification_settings")
    .upsert(row, { onConflict: "user_id" });
  if (error) {
    return jsonResponse({ ok: false, error: publicError(error, "Notification settings could not be saved") }, 500, requestId);
  }
  return responsePayload(auth, requestId);
}

export async function PATCH(request) {
  const requestId = getRequestId(request);
  if (!mutationOriginAllowed(request)) {
    return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
  }
  const auth = await requireAuth(request, requestId);
  if (auth.error) return auth.error;
  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "notification_write",
    limit: 30,
    windowSeconds: 60
  });
  if (limited) return limited;

  const body = await readJsonBody(request, 4 * 1024);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);
  const now = new Date().toISOString();

  if (body.data?.markAllRead === true) {
    const { error } = await auth.supabase
      .from("notification_items")
      .update({ read_at: now })
      .eq("user_id", auth.user.id)
      .is("dismissed_at", null)
      .is("read_at", null);
    if (error) return jsonResponse({ ok: false, error: publicError(error, "Notifications could not be marked read") }, 500, requestId);
    return responsePayload(auth, requestId);
  }

  const id = cleanText(body.data?.id, 80);
  const read = typeof body.data?.read === "boolean" ? body.data.read : null;
  if (!id || read === null) {
    return jsonResponse({ ok: false, error: "Notification ID and read state are required" }, 400, requestId);
  }
  const { data, error } = await auth.supabase
    .from("notification_items")
    .update({ read_at: read ? now : null })
    .eq("user_id", auth.user.id)
    .eq("id", id)
    .is("dismissed_at", null)
    .select("id")
    .maybeSingle();
  if (error) return jsonResponse({ ok: false, error: publicError(error, "Notification could not be updated") }, 500, requestId);
  if (!data) return jsonResponse({ ok: false, error: "Notification not found" }, 404, requestId);
  return responsePayload(auth, requestId);
}

export async function DELETE(request) {
  const requestId = getRequestId(request);
  if (!mutationOriginAllowed(request)) {
    return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
  }
  const auth = await requireAuth(request, requestId);
  if (auth.error) return auth.error;
  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "notification_write",
    limit: 30,
    windowSeconds: 60
  });
  if (limited) return limited;

  const body = await readJsonBody(request, 4 * 1024);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);
  const id = cleanText(body.data?.id, 80);
  const dismissAll = body.data?.dismissAll === true;
  if (!id && !dismissAll) {
    return jsonResponse({ ok: false, error: "Notification ID is required" }, 400, requestId);
  }

  let query = auth.supabase
    .from("notification_items")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("user_id", auth.user.id)
    .is("dismissed_at", null);
  if (!dismissAll) query = query.eq("id", id);
  const { error } = await query;
  if (error) return jsonResponse({ ok: false, error: publicError(error, "Notification could not be dismissed") }, 500, requestId);
  return responsePayload(auth, requestId);
}
