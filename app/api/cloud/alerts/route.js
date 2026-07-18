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

const STATUS_VALUES = new Set(["all", "unread", "active", "resolved"]);

function filterItems(items, status) {
  if (status === "unread") return items.filter((item) => !item.read_at);
  if (status === "active") return items.filter((item) => item.active);
  if (status === "resolved") return items.filter((item) => !item.active);
  return items;
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

  const inbox = await loadAlertInbox(auth.supabase, auth.user.id, { limit });
  if (inbox.error) {
    return jsonResponse({ ok: false, error: publicError(inbox.error, "Alert Inbox could not be loaded") }, 500, requestId);
  }

  return jsonResponse({
    ok: true,
    available: inbox.available,
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
  if ((!id && !markAllRead) || (id && markAllRead)) {
    return jsonResponse({ ok: false, error: "Choose one alert or mark all unread alerts" }, 400, requestId);
  }

  let query = auth.supabase
    .from("alert_inbox")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", auth.user.id)
    .is("read_at", null);

  if (id) query = query.eq("id", id);
  const { data, error } = await query.select("id");
  if (error) {
    return jsonResponse({ ok: false, error: publicError(error, "Alert Inbox could not be updated") }, 500, requestId);
  }
  if (id && !(data || []).length) {
    return jsonResponse({ ok: false, error: "Unread alert not found" }, 404, requestId);
  }

  const inbox = await loadAlertInbox(auth.supabase, auth.user.id);
  return jsonResponse({
    ok: true,
    updated: (data || []).length,
    summary: inbox.summary,
    items: inbox.items
  }, 200, requestId);
}
