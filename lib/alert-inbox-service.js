const ALERT_SELECT_V1 = "id,watchlist_id,fingerprint,alert_type,severity,title,message,match,selection,details,active,read_at,resolved_at,first_seen_at,last_seen_at,created_at,updated_at";
const ALERT_SELECT_V2 = `${ALERT_SELECT_V1},dismissed_at`;
const MAX_INBOX_ROWS = 500;
const MAX_VISIBLE_ROWS = 100;

function text(value, maximum = 240, fallback = "") {
  return String(value || fallback)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function finite(value, min, max) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(min, Math.min(max, number));
}

function isMissingTable(error) {
  return error?.code === "42P01" || /does not exist/i.test(error?.message || "");
}

function isMissingColumn(error) {
  return error?.code === "42703" || /column .* does not exist/i.test(error?.message || "");
}

function safeDetails(alert = {}) {
  return {
    eventId: text(alert.eventId, 180) || null,
    commenceTime: text(alert.commenceTime, 80) || null,
    minutesToKickoff: finite(alert.minutesToKickoff, -100000, 100000),
    addedDecision: text(alert.addedDecision, 20) || null,
    currentDecision: text(alert.currentDecision, 20) || null,
    addedOdds: finite(alert.addedOdds, 0, 10000),
    currentOdds: finite(alert.currentOdds, 0, 10000),
    oddsMove: finite(alert.oddsMove, -10, 10),
    minimumPlayOdds: finite(alert.minimumPlayOdds, 0, 10000)
  };
}

function summary(items) {
  const rows = Array.isArray(items) ? items : [];
  const visible = rows.filter((item) => !item.dismissed_at);
  return {
    total: visible.length,
    unread: visible.filter((item) => !item.read_at).length,
    active: visible.filter((item) => item.active).length,
    high: visible.filter((item) => item.active && item.severity === "high").length,
    medium: visible.filter((item) => item.active && item.severity === "medium").length,
    resolved: visible.filter((item) => !item.active).length,
    dismissed: rows.filter((item) => Boolean(item.dismissed_at)).length
  };
}

async function loadRows(supabase, userId) {
  const v2 = await supabase
    .from("alert_inbox")
    .select(ALERT_SELECT_V2)
    .eq("user_id", userId)
    .order("last_seen_at", { ascending: false })
    .limit(MAX_INBOX_ROWS);

  if (!v2.error) return { rows: v2.data || [], v2Available: true, error: null };
  if (!isMissingColumn(v2.error)) return { rows: [], v2Available: false, error: v2.error };

  const v1 = await supabase
    .from("alert_inbox")
    .select(ALERT_SELECT_V1)
    .eq("user_id", userId)
    .order("last_seen_at", { ascending: false })
    .limit(MAX_INBOX_ROWS);

  return {
    rows: (v1.data || []).map((item) => ({ ...item, dismissed_at: null })),
    v2Available: false,
    error: v1.error || null
  };
}

export async function loadAlertInbox(supabase, userId, { limit = MAX_VISIBLE_ROWS, includeDismissed = false } = {}) {
  const safeLimit = Math.max(1, Math.min(MAX_VISIBLE_ROWS, Math.trunc(Number(limit) || MAX_VISIBLE_ROWS)));
  const result = await loadRows(supabase, userId);

  if (result.error) {
    if (isMissingTable(result.error)) {
      return {
        available: false,
        v2Available: false,
        items: [],
        summary: summary([]),
        warning: "Alert Inbox migration is not active"
      };
    }
    return { available: false, v2Available: false, items: [], summary: summary([]), error: result.error };
  }

  const items = (includeDismissed ? result.rows : result.rows.filter((item) => !item.dismissed_at)).slice(0, safeLimit);
  return {
    available: true,
    v2Available: result.v2Available,
    items,
    summary: summary(result.rows),
    warning: result.v2Available ? null : "Alert Inbox V2 dismissal migration is not active"
  };
}

export async function syncAlertInbox(supabase, userId, alerts = [], { now = new Date().toISOString() } = {}) {
  const currentAlerts = (Array.isArray(alerts) ? alerts : [])
    .filter((alert) => text(alert?.id, 240) && text(alert?.watchlistId, 80))
    .slice(0, MAX_INBOX_ROWS);

  const initialExisting = await supabase
    .from("alert_inbox")
    .select("id,fingerprint,active,read_at,first_seen_at,dismissed_at")
    .eq("user_id", userId)
    .limit(MAX_INBOX_ROWS);

  let existingData = initialExisting.data;
  let existingError = initialExisting.error;
  let v2Available = true;

  if (existingError && isMissingColumn(existingError)) {
    const fallback = await supabase
      .from("alert_inbox")
      .select("id,fingerprint,active,read_at,first_seen_at")
      .eq("user_id", userId)
      .limit(MAX_INBOX_ROWS);
    existingData = (fallback.data || []).map((item) => ({ ...item, dismissed_at: null }));
    existingError = fallback.error;
    v2Available = false;
  }

  if (existingError) {
    if (isMissingTable(existingError)) return loadAlertInbox(supabase, userId);
    return { available: false, v2Available: false, items: [], summary: summary([]), error: existingError };
  }

  const existing = existingData || [];
  const byFingerprint = new Map(existing.map((item) => [item.fingerprint, item]));
  const currentFingerprints = new Set();
  const rows = currentAlerts.map((alert) => {
    const fingerprint = text(alert.id, 240);
    const previous = byFingerprint.get(fingerprint);
    currentFingerprints.add(fingerprint);
    const row = {
      user_id: userId,
      watchlist_id: text(alert.watchlistId, 80),
      fingerprint,
      alert_type: text(alert.type, 80, "watchlist_alert"),
      severity: ["high", "medium", "info"].includes(alert.severity) ? alert.severity : "info",
      title: text(alert.title, 240, "Scorecaster alert"),
      message: text(alert.message, 800, "A watched selection changed."),
      match: text(alert.match, 240) || null,
      selection: text(alert.selection, 160) || null,
      details: safeDetails(alert),
      active: true,
      read_at: previous?.active ? previous.read_at : null,
      resolved_at: null,
      first_seen_at: previous?.first_seen_at || now,
      last_seen_at: now
    };
    if (v2Available) row.dismissed_at = previous?.active ? previous.dismissed_at : null;
    return row;
  });

  if (rows.length) {
    const { error: upsertError } = await supabase
      .from("alert_inbox")
      .upsert(rows, { onConflict: "user_id,fingerprint" });
    if (upsertError) return { available: false, v2Available, items: [], summary: summary([]), error: upsertError };
  }

  const resolvedIds = existing
    .filter((item) => item.active && !currentFingerprints.has(item.fingerprint))
    .map((item) => item.id);

  if (resolvedIds.length) {
    const { error: resolveError } = await supabase
      .from("alert_inbox")
      .update({ active: false, resolved_at: now, last_seen_at: now })
      .eq("user_id", userId)
      .in("id", resolvedIds);
    if (resolveError) return { available: false, v2Available, items: [], summary: summary([]), error: resolveError };
  }

  return loadAlertInbox(supabase, userId);
}

export const ALERT_INBOX_SELECT = ALERT_SELECT_V2;
export const ALERT_INBOX_SELECT_V1 = ALERT_SELECT_V1;
export const ALERT_INBOX_MAX_ROWS = MAX_INBOX_ROWS;
