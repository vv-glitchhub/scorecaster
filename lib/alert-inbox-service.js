const ALERT_SELECT_V1 = "id,watchlist_id,fingerprint,alert_type,severity,title,message,match,selection,details,active,read_at,resolved_at,first_seen_at,last_seen_at,created_at,updated_at";
const ALERT_SELECT_V2 = `${ALERT_SELECT_V1},dismissed_at`;
const SETTINGS_SELECT = "enabled,minimum_severity,kickoff_enabled,price_enabled,decision_enabled,availability_enabled,created_at,updated_at";
const MAX_INBOX_ROWS = 500;
const MAX_VISIBLE_ROWS = 100;
const SEVERITY_RANK = { info: 1, medium: 2, high: 3 };

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

export function defaultAlertInboxSettings() {
  return {
    enabled: true,
    minimum_severity: "info",
    kickoff_enabled: true,
    price_enabled: true,
    decision_enabled: true,
    availability_enabled: true
  };
}

export function normalizeAlertInboxSettings(value = {}) {
  const defaults = defaultAlertInboxSettings();
  const minimumSeverity = ["info", "medium", "high"].includes(value.minimumSeverity || value.minimum_severity)
    ? value.minimumSeverity || value.minimum_severity
    : defaults.minimum_severity;
  return {
    enabled: value.enabled ?? defaults.enabled,
    minimum_severity: minimumSeverity,
    kickoff_enabled: value.kickoffEnabled ?? value.kickoff_enabled ?? defaults.kickoff_enabled,
    price_enabled: value.priceEnabled ?? value.price_enabled ?? defaults.price_enabled,
    decision_enabled: value.decisionEnabled ?? value.decision_enabled ?? defaults.decision_enabled,
    availability_enabled: value.availabilityEnabled ?? value.availability_enabled ?? defaults.availability_enabled
  };
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

function typeEnabled(type, settings) {
  if (type === "kickoff_soon") return settings.kickoff_enabled;
  if (type === "price_moved" || type === "below_play_price") return settings.price_enabled;
  if (type === "decision_changed") return settings.decision_enabled;
  return settings.availability_enabled;
}

function alertAllowed(alert, settings) {
  if (!settings.enabled) return false;
  const severity = ["high", "medium", "info"].includes(alert?.severity) ? alert.severity : "info";
  if (SEVERITY_RANK[severity] < SEVERITY_RANK[settings.minimum_severity]) return false;
  return typeEnabled(text(alert?.type, 80, "watchlist_alert"), settings);
}

async function loadRows(supabase, userId) {
  const v2 = await supabase
    .from("alert_inbox")
    .select(ALERT_SELECT_V2)
    .eq("user_id", userId)
    .order("last_seen_at", { ascending: false })
    .limit(MAX_INBOX_ROWS);
  if (!v2.error) return { rows: v2.data || [], v2: true, error: null };
  if (!isMissingColumn(v2.error)) return { rows: [], v2: false, error: v2.error };

  const v1 = await supabase
    .from("alert_inbox")
    .select(ALERT_SELECT_V1)
    .eq("user_id", userId)
    .order("last_seen_at", { ascending: false })
    .limit(MAX_INBOX_ROWS);
  return {
    rows: (v1.data || []).map((item) => ({ ...item, dismissed_at: null })),
    v2: false,
    error: v1.error || null
  };
}

export async function loadAlertInboxSettings(supabase, userId) {
  const { data, error } = await supabase
    .from("alert_inbox_settings")
    .select(SETTINGS_SELECT)
    .eq("user_id", userId)
    .maybeSingle();
  if (error && isMissingTable(error)) {
    return { available: false, settings: defaultAlertInboxSettings(), warning: "Alert Inbox V2 settings migration is not active" };
  }
  if (error) return { available: false, settings: defaultAlertInboxSettings(), error };
  return { available: true, settings: normalizeAlertInboxSettings(data || {}), warning: null };
}

export async function loadAlertInbox(supabase, userId, { limit = MAX_VISIBLE_ROWS, includeDismissed = false } = {}) {
  const safeLimit = Math.max(1, Math.min(MAX_VISIBLE_ROWS, Math.trunc(Number(limit) || MAX_VISIBLE_ROWS)));
  const [rowsResult, settingsResult] = await Promise.all([
    loadRows(supabase, userId),
    loadAlertInboxSettings(supabase, userId)
  ]);

  if (rowsResult.error) {
    if (isMissingTable(rowsResult.error)) {
      return {
        available: false,
        v2Available: false,
        items: [],
        summary: summary([]),
        settings: settingsResult.settings,
        settingsAvailable: settingsResult.available,
        warning: "Alert Inbox migration is not active"
      };
    }
    return { available: false, v2Available: false, items: [], summary: summary([]), settings: settingsResult.settings, error: rowsResult.error };
  }
  if (settingsResult.error) {
    return { available: false, v2Available: rowsResult.v2, items: [], summary: summary([]), settings: settingsResult.settings, error: settingsResult.error };
  }

  const allRows = rowsResult.rows;
  const visible = (includeDismissed ? allRows : allRows.filter((item) => !item.dismissed_at)).slice(0, safeLimit);
  const warnings = [
    rowsResult.v2 ? null : "Alert Inbox V2 dismissal migration is not active",
    settingsResult.warning || null
  ].filter(Boolean);
  return {
    available: true,
    v2Available: rowsResult.v2 && settingsResult.available,
    items: visible,
    summary: summary(allRows),
    settings: settingsResult.settings,
    settingsAvailable: settingsResult.available,
    warning: warnings.length ? warnings.join("; ") : null
  };
}

export async function saveAlertInboxSettings(supabase, userId, value = {}) {
  const settings = normalizeAlertInboxSettings(value);
  const row = { user_id: userId, ...settings };
  const { error } = await supabase
    .from("alert_inbox_settings")
    .upsert(row, { onConflict: "user_id" });
  if (error) return { available: false, settings, error };
  return { available: true, settings, warning: null };
}

export async function syncAlertInbox(supabase, userId, alerts = [], { now = new Date().toISOString() } = {}) {
  const settingsResult = await loadAlertInboxSettings(supabase, userId);
  if (settingsResult.error) return { available: false, items: [], summary: summary([]), settings: settingsResult.settings, error: settingsResult.error };
  const settings = settingsResult.settings;
  const currentAlerts = (Array.isArray(alerts) ? alerts : [])
    .filter((alert) => text(alert?.id, 240) && text(alert?.watchlistId, 80) && alertAllowed(alert, settings))
    .slice(0, MAX_INBOX_ROWS);

  const existingQuery = await supabase
    .from("alert_inbox")
    .select("id,fingerprint,active,read_at,first_seen_at,dismissed_at")
    .eq("user_id", userId)
    .limit(MAX_INBOX_ROWS);
  let existingData = existingQuery.data;
  let existingError = existingQuery.error;
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
    return { available: false, items: [], summary: summary([]), settings, error: existingError };
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
    if (upsertError) return { available: false, items: [], summary: summary([]), settings, error: upsertError };
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
    if (resolveError) return { available: false, items: [], summary: summary([]), settings, error: resolveError };
  }

  return loadAlertInbox(supabase, userId);
}

export const ALERT_INBOX_SELECT = ALERT_SELECT_V2;
export const ALERT_INBOX_SELECT_V1 = ALERT_SELECT_V1;
export const ALERT_INBOX_MAX_ROWS = MAX_INBOX_ROWS;
