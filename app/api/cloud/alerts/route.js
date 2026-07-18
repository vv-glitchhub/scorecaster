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
import { loadAlertInbox } from "../../../../lib/alert-inbox-service.js";

export const dynamic = "force-dynamic";

const STATUS_VALUES = new Set(["all", "unread", "active", "resolved", "dismissed"]);
const ACTION_VALUES = new Set(["read", "dismiss", "restore"]);

function isMissingColumn(error) {
  return error?.code === "42703" || /column .* does not exist/i.test(error?.message || "");
}

function filterItems(items, status) {
  if (status === "unread") return items.filter((item) => !item.read_at && !item.dismissed_at);
  if (status === "active") return items.filter((item) => item.active && !item.dismissed_at);
  if (status === "resolved") return items.filter((item) => !item.active && !item.dismissed_at);
  if (status === "dismissed") return items.filter((item) => Boolean(item.dismissed_at));
  return items.filter((item) => !item.dismissed_at);
}

export async function GET(request) {
  const requestId = getRequestId(request);
  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, requestId);

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

  const inbox = await loadAlertInbox(auth.supabase, auth.user.id, {
    limit,
    includeDismissed: status === "dismissed"
  });
  if (inbox.error) {
    return jsonResponse({ ok: false, error: publicError(inbox.error, "Alert Inbox could not be loaded") }, 500, requestId);
  }

  return jsonResponse({
    ok: true,
    available: inbox.available,
    v2Available: inbox.v2Available,
    warning: inbox.warning || null,
    status,
    summary: inbox.summary,
    items: filterItems(inbox.items, status)
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
    bucket: "alert_inbox_write",
    limit: 30,
    windowSeconds: 60
  });
  if (limited) return limited;

  const body = await readJsonBody(request, 4096);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);

  const id = cleanText(body.data?.id, 80);
  const markAllRead = body.data?.markAllRead === true;
  const action = cleanText(body.data?.action, 20, "read").toLowerCase();
  if ((!id && !markAllRead) || (id && markAllRead)) {
    return jsonResponse({ ok: false, error: "Choose one alert or mark all unread alerts" }, 400, requestId);
  }
  if (!markAllRead && !ACTION_VALUES.has(action)) {
    return jsonResponse({ ok: false, error: "Unsupported Alert Inbox action" }, 400, requestId);
  }

  const now = new Date().toISOString();
  let query;
  let appliedAction = action;

  if (markAllRead) {
    appliedAction = "read_all";
    query = auth.supabase
      .from("alert_inbox")
      .update({ read_at: now })
      .eq("user_id", auth.user.id)
      .is("read_at", null);
  } else if (action === "dismiss") {
    query = auth.supabase
      .from("alert_inbox")
      .update({ dismissed_at: now, read_at: now })
      .eq("user_id", auth.user.id)
      .eq("id", id);
  } else if (action === "restore") {
    query = auth.supabase
      .from("alert_inbox")
      .update({ dismissed_at: null })
      .eq("user_id", auth.user.id)
      .eq("id", id);
  } else {
    query = auth.supabase
      .from("alert_inbox")
      .update({ read_at: now })
      .eq("user_id", auth.user.id)
      .eq("id", id)
      .is("read_at", null);
  }

  const { data, error } = await query.select("id");
  if (error) {
    const status = isMissingColumn(error) && ["dismiss", "restore"].includes(action) ? 503 : 500;
    const fallback = status === 503
      ? "Alert Inbox V2 dismissal migration is not active"
      : "Alert Inbox could not be updated";
    return jsonResponse({ ok: false, error: publicError(error, fallback) }, status, requestId);
  }
  if (id && !(data || []).length) {
    return jsonResponse({ ok: false, error: "Alert not found or already updated" }, 404, requestId);
  }

  const inbox = await loadAlertInbox(auth.supabase, auth.user.id);
  if (inbox.error) {
    return jsonResponse({ ok: false, error: publicError(inbox.error, "Alert Inbox could not be reloaded") }, 500, requestId);
  }
  return jsonResponse({
    ok: true,
    action: appliedAction,
    updated: (data || []).length,
    available: inbox.available,
    v2Available: inbox.v2Available,
    warning: inbox.warning || null,
    summary: inbox.summary,
    items: inbox.items
  }, 200, requestId);
}
