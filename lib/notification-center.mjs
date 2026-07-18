const TYPES = new Set([
  "kickoff_soon",
  "decision_changed",
  "price_moved",
  "below_play_price",
  "market_unavailable",
  "fixture_passed"
]);
const SEVERITY_RANK = { info: 1, medium: 2, high: 3 };

function text(value, maximum = 240) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function rounded(value, digits = 4) {
  const number = finite(value, NaN);
  return Number.isFinite(number) ? Number(number.toFixed(digits)) : null;
}

function hash(value) {
  let result = 2166136261;
  const source = String(value || "");
  for (let index = 0; index < source.length; index += 1) {
    result ^= source.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16).padStart(8, "0");
}

export function normalizeNotificationSettings(value = {}) {
  const minimumSeverity = ["info", "medium", "high"].includes(value.minimumSeverity || value.minimum_severity)
    ? value.minimumSeverity || value.minimum_severity
    : "info";

  return {
    inAppEnabled: value.inAppEnabled ?? value.in_app_enabled ?? true,
    minimumSeverity,
    kickoffEnabled: value.kickoffEnabled ?? value.kickoff_enabled ?? true,
    priceEnabled: value.priceEnabled ?? value.price_enabled ?? true,
    decisionEnabled: value.decisionEnabled ?? value.decision_enabled ?? true,
    availabilityEnabled: value.availabilityEnabled ?? value.availability_enabled ?? true
  };
}

function typeEnabled(type, settings) {
  if (type === "kickoff_soon") return settings.kickoffEnabled;
  if (type === "price_moved" || type === "below_play_price") return settings.priceEnabled;
  if (type === "decision_changed") return settings.decisionEnabled;
  return settings.availabilityEnabled;
}

function fingerprint(alert = {}) {
  if (alert.type === "kickoff_soon") {
    return finite(alert.minutesToKickoff) <= 30 ? "within-30m" : "within-window";
  }
  if (alert.type === "decision_changed") {
    return `${text(alert.addedDecision, 20)}-${text(alert.currentDecision, 20)}`;
  }
  if (alert.type === "price_moved") {
    const threshold = Math.max(0.005, finite(alert.moveThreshold, 0.05));
    const movement = finite(alert.oddsMove);
    const direction = movement < 0 ? "down" : "up";
    const bucket = Math.max(1, Math.min(6, Math.floor(Math.abs(movement) / threshold)));
    return `${direction}-${bucket}x`;
  }
  if (alert.type === "below_play_price") {
    const current = finite(alert.currentOdds);
    const floor = finite(alert.minimumPlayOdds);
    const gap = floor > 0 ? Math.max(0, (floor - current) / floor) : 0;
    return `gap-${Math.max(1, Math.min(6, Math.floor(gap / 0.02) + 1))}`;
  }
  return "state";
}

function payload(alert = {}) {
  return {
    addedDecision: text(alert.addedDecision, 20) || null,
    currentDecision: text(alert.currentDecision, 20) || null,
    minutesToKickoff: Number.isFinite(Number(alert.minutesToKickoff)) ? Math.max(0, Math.round(Number(alert.minutesToKickoff))) : null,
    addedOdds: rounded(alert.addedOdds),
    currentOdds: rounded(alert.currentOdds),
    oddsMove: rounded(alert.oddsMove),
    minimumPlayOdds: rounded(alert.minimumPlayOdds),
    source: "watchlist-alerts-v2"
  };
}

export function buildNotificationCandidates(alerts = [], rawSettings = {}, now = Date.now()) {
  const settings = normalizeNotificationSettings(rawSettings);
  if (!settings.inAppEnabled) return [];
  const minimumRank = SEVERITY_RANK[settings.minimumSeverity] || 1;
  const generatedAt = new Date(now).toISOString();
  const unique = new Map();

  for (const alert of Array.isArray(alerts) ? alerts : []) {
    const type = text(alert?.type, 40);
    const severity = text(alert?.severity, 20).toLowerCase();
    if (!TYPES.has(type) || !SEVERITY_RANK[severity]) continue;
    if (SEVERITY_RANK[severity] < minimumRank || !typeEnabled(type, settings)) continue;

    const watchlistId = text(alert.watchlistId, 80);
    const eventId = text(alert.eventId, 180);
    const selection = text(alert.selection, 160);
    if (!watchlistId || !eventId || !selection) continue;

    const state = fingerprint(alert);
    const canonical = `${watchlistId}|${eventId}|${type}|${state}`;
    const sourceKey = `watchlist:${type}:${hash(canonical)}`;
    unique.set(sourceKey, {
      source_key: sourceKey,
      source_type: "watchlist",
      notification_type: type,
      severity,
      watchlist_id: watchlistId,
      event_id: eventId,
      match: text(alert.match, 240),
      selection,
      commence_time: alert.commenceTime && Number.isFinite(Date.parse(alert.commenceTime)) ? new Date(alert.commenceTime).toISOString() : null,
      payload: payload(alert),
      last_seen_at: generatedAt
    });
  }

  return [...unique.values()]
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
    .slice(0, 50);
}

export function summarizeNotifications(items = []) {
  const visible = (Array.isArray(items) ? items : []).filter((item) => !item.dismissed_at);
  const unread = visible.filter((item) => !item.read_at);
  return {
    total: visible.length,
    unread: unread.length,
    high: visible.filter((item) => item.severity === "high").length,
    unreadHigh: unread.filter((item) => item.severity === "high").length
  };
}
