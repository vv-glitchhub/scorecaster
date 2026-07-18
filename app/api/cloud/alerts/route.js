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
import {
  loadAlertInbox,
  normalizeAlertInboxSettings,
  saveAlertInboxSettings
} from "../../../../lib/alert-inbox-service.js";

export const dynamic = "force-dynamic";

const STATUS_VALUES = new Set(["all", "unread", "active", "resolved", "dismissed"]);

function filterItems(items, status) {
  if (status === "unread") return items.filter((item) => !item.read_at && !item.dismissed_at);
  if (status === "active") return items.filter((item) => item.active && !item.dismissed_at);
  if (status === "resolved") return items.filter((item) => !item.active && !item.dismissed_at);
  if (status === "dismissed") return items.filter((item) => Boolean(item.dismissed_at));
  return items.filter((item) => !item.dismissed_at);
}

async function requireAuth(request, requestId) {
  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) return { error: jsonResponse({ ok: false, error: auth.error }, auth.status, requestId) };
  return auth;
}

async function inboxResponse(auth, requestId, { status = "all", limit = 100, extra = {} } = {}) {
  const inbox = await loadAlertInbox(auth.supabase, auth.user.id, {
    limit,
    includeDismissed: status === "dismissed"
  });
  if (inbox.error) {
    return jsonResponse({ ok: false, error: publicError(inbox.error, "Alert Inbox could not be loaded") }, 500, requestId);
  }
  return jsonResponse({
    ok: true,
    version: "alert-inbox-v2",
    available: inbox.available,
    v2Available: inbox.v2Available === true,
    warning: inbox.warning || null,
    status,
    settings: inbox.settings,
    settingsAvailable: inbox.settingsAvailable === true,
    summary: inbox.summary,
    items: filterItems(inbox.items, status),
    pushEnabled: false,
    ...extra
  }, 200, requestId);
}

export async function GET(request) {
  const requestId = getRequestId(request);
  const auth = await requireAuth(request, requestId);
  if (auth.error) return auth.error;

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "alert_inbox_read",
    limit: 60,
    windowSeconds: 60
  });
  if (limited) return limited;

  const url = new URL(request.url);
  const unknown = [...url.searchParams.keys()].filter((key) => !["status", "limit"].includes(key));
  if (unknown.length) return jsonResponse({ ok: false, error: "Unsupported query parameter" }, 400, requestId);

  const status = cleanText(url.searchParams.get("status"), 20, "all").toLowerCase();
  const limit = boundedNumber(url.searchParams.get("limit"), { min: 1, max: 100, fallback: 100 });
  if (!STATUS_VALUES.has(status)) return jsonResponse({ ok: false, error: "Unsupported alert status" }, 400, requestId);

  return inboxResponse(auth, requestId, { status, limit });
}

export async function PUT(request) {
  const requestId = getRequestId(request);
  if (!mutationOriginAllowed(request)) {
    return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
  }
  const auth = await requireAuth(request, requestId);
  if (auth.error) return auth.error;

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "alert_inbox_settings",
    limit: 20,
    windowSeconds: 60
  });
  if (limited) return limited;

  const body = await readJsonBody(request, 4096);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);
  const settings = normalizeAlertInboxSettings(body.data || {});
  const saved = await saveAlertInboxSettings(auth.supabase, auth.user.id, settings);
  if (saved.error) {
    const status = saved.error?.code === "42P01" ? 503 : 500;
    return jsonResponse({ ok: false, error: publicError(saved.error, "Alert Inbox settings could not be saved") }, status, requestId);
  }
  return inboxResponse(auth, requestId, { extra: { settingsUpdated: true } });
}

export async function PATCH(request) {
  const requestId = getRequestId(request);
  if (!mutationOriginAllowed(request)) {
    return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
  }
  const auth = await requireAuth(request, requestId);
  if (auth.error) return auth.error;

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "alert_inbox_write",
    limit: 30,
    windowSeconds: 60
  });
  if (limited) return limited;

  const body = await readJsonBody(request, 4096);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);

  const id = cleanText(body.data?.id, 80);
  const markAllRead = body.data?.markAllRead === true;
  const read = typeof body.data?.read === "boolean" ? body.data.read : null;
  if (markAllRead && (id || read !== null)) {
    return jsonResponse({ ok: false, error: "Mark-all-read cannot be combined with another alert update" }, 400, requestId);
  }
  if (!markAllRead && (!id || read === null)) {
    return jsonResponse({ ok: false, error: "Alert ID and read state are required" }, 400, requestId);
  }

  const now = new Date().toISOString();
  let query = auth.supabase
    .from("alert_inbox")
    .update({ read_at: markAllRead || read ? now : null })
    .eq("user_id", auth.user.id)
    .is("dismissed_at", null);
  if (markAllRead) query = query.is("read_at", null);
  else query = query.eq("id", id);

  const { data, error } = await query.select("id");
  if (error) {
    const status = error?.code === "42703" ? 503 : 500;
    return jsonResponse({ ok: false, error: publicError(error, "Alert Inbox could not be updated") }, status, requestId);
  }
  if (!markAllRead && !(data || []).length) {
    return jsonResponse({ ok: false, error: "Visible alert not found" }, 404, requestId);
  }

  return inboxResponse(auth, requestId, { extra: { updated: (data || []).length } });
}

export async function DELETE(request) {
  const requestId = getRequestId(request);
  if (!mutationOriginAllowed(request)) {
    return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
  }
  const auth = await requireAuth(request, requestId);
  if (auth.error) return auth.error;

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "alert_inbox_write",
    limit: 30,
    windowSeconds: 60
  });
  if (limited) return limited;

  const body = await readJsonBody(request, 4096);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);
  const id = cleanText(body.data?.id, 80);
  const dismissAll = body.data?.dismissAll === true;
  if ((!id && !dismissAll) || (id && dismissAll)) {
    return jsonResponse({ ok: false, error: "Choose one alert or dismiss all visible alerts" }, 400, requestId);
  }

  let query = auth.supabase
    .from("alert_inbox")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("user_id", auth.user.id)
    .is("dismissed_at", null);
  if (id) query = query.eq("id", id);
  const { data, error } = await query.select("id");
  if (error) {
    const status = error?.code === "42703" ? 503 : 500;
    return jsonResponse({ ok: false, error: publicError(error, "Alert could not be removed from the inbox") }, status, requestId);
  }
  if (id && !(data || []).length) {
    return jsonResponse({ ok: false, error: "Visible alert not found" }, 404, requestId);
  }

  return inboxResponse(auth, requestId, { extra: { dismissed: (data || []).length } });
}
