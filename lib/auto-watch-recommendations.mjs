export const AUTO_WATCH_SOURCE = "scorecaster-auto-watch-recommendations-v1";
export const AUTO_WATCH_VERSION = "scorecaster-auto-watch-recommendations-v2";

function text(value, maximum = 500) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function number(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max, fallback) {
  const parsed = number(value, fallback);
  return Math.min(max, Math.max(min, parsed));
}

function normalizeSportKeys(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map((item) => text(item, 120).toLowerCase())
    .filter((item) => /^[a-z0-9_:-]+$/.test(item)))]
    .slice(0, 20);
}

export function normalizedAutoWatchPreferences(input = {}) {
  const selectionMode = text(input.selection_mode ?? input.selectionMode, 40) === "play-only"
    ? "play-only"
    : "play-and-caution";
  return {
    enabled: input.enabled === true,
    topN: Math.trunc(clamp(input.top_n ?? input.topN, 1, 10, 3)),
    alertMovePercent: clamp(input.alert_move_percent ?? input.alertMovePercent, 0.005, 0.5, 0.03),
    alertBeforeMinutes: Math.trunc(clamp(input.alert_before_minutes ?? input.alertBeforeMinutes, 15, 10080, 120)),
    selectionMode,
    minScore: clamp(input.min_score ?? input.minScore, 0, 100, 0),
    minEdge: clamp(input.min_edge ?? input.minEdge, 0, 0.20, 0),
    minEv: clamp(input.min_ev ?? input.minEv, 0, 1, 0),
    sportKeys: normalizeSportKeys(input.sport_keys ?? input.sportKeys)
  };
}

export function autoWatchSelectionKey(item = {}) {
  const eventId = text(item.event_id || item.eventId || item.gameId || item.id, 180);
  const market = text(item.market || item.marketKey || "h2h", 80).toLowerCase();
  const selection = text(item.selection || item.label, 160).toLowerCase();
  return `${eventId}::${market}::${selection}`;
}

export function isAutoManagedWatchlistItem(item = {}) {
  return item?.raw_pick?.source === AUTO_WATCH_SOURCE;
}

function recommendationDecision(item = {}) {
  return text(item.decision || item.productDecision, 20).toUpperCase();
}

function validRecommendation(item = {}) {
  const kickoff = Date.parse(String(item.commenceTime || ""));
  const odds = number(item.odds);
  const decision = recommendationDecision(item);
  return Boolean(
    text(item.eventId || item.gameId || item.id, 180) &&
    text(item.selection || item.label, 160) &&
    text(item.sportKey || item.sport, 120) &&
    Number.isFinite(kickoff) &&
    odds !== null && odds > 1 &&
    (decision === "PLAY" || decision === "CAUTION")
  );
}

export function recommendationPassesAutoWatchFilters(item = {}, preferences = {}) {
  const prefs = normalizedAutoWatchPreferences(preferences);
  if (!validRecommendation(item)) return false;
  const decision = recommendationDecision(item);
  const score = number(item.score, 0);
  const edge = number(item.edge, 0);
  const ev = number(item.ev, 0);
  const sportKey = text(item.sportKey || item.sport, 120).toLowerCase();

  if (prefs.selectionMode === "play-only" && decision !== "PLAY") return false;
  if (score < prefs.minScore) return false;
  if (edge < prefs.minEdge) return false;
  if (ev < prefs.minEv) return false;
  if (prefs.sportKeys.length && !prefs.sportKeys.includes(sportKey)) return false;
  return true;
}

export function selectAutoWatchRecommendations(recommendations = [], preferences = {}) {
  const prefs = normalizedAutoWatchPreferences(preferences);
  if (!prefs.enabled) return [];
  return (Array.isArray(recommendations) ? recommendations : [])
    .filter((item) => recommendationPassesAutoWatchFilters(item, prefs))
    .slice(0, prefs.topN);
}

export function buildAutoWatchRow(recommendation = {}, preferences = {}, userId) {
  const prefs = normalizedAutoWatchPreferences(preferences);
  if (!userId || !validRecommendation(recommendation)) return null;
  const commenceTime = new Date(recommendation.commenceTime);
  const decision = recommendationDecision(recommendation);
  const odds = number(recommendation.odds);
  const rank = Math.max(1, Math.trunc(number(recommendation.rank, 1)));

  return {
    user_id: userId,
    event_id: text(recommendation.eventId || recommendation.gameId || recommendation.id, 180),
    sport: text(recommendation.sportKey || recommendation.sport, 120),
    league: text(recommendation.league || recommendation.sportTitle, 120) || null,
    market: text(recommendation.marketKey || recommendation.market || "h2h", 80) || "h2h",
    selection: text(recommendation.selection || recommendation.label, 160),
    home_team: text(recommendation.homeTeam, 160) || null,
    away_team: text(recommendation.awayTeam, 160) || null,
    match: text(recommendation.match || [recommendation.homeTeam, recommendation.awayTeam].filter(Boolean).join(" – "), 240),
    commence_time: commenceTime.toISOString(),
    added_odds: odds,
    added_decision: decision,
    alert_move_percent: prefs.alertMovePercent,
    alert_before_minutes: prefs.alertBeforeMinutes,
    active: true,
    raw_pick: {
      source: AUTO_WATCH_SOURCE,
      autoWatchVersion: AUTO_WATCH_VERSION,
      autoWatchRank: rank,
      selectionMode: prefs.selectionMode,
      minScore: prefs.minScore,
      minEdge: prefs.minEdge,
      minEv: prefs.minEv,
      sportKeys: prefs.sportKeys,
      recommendationScore: number(recommendation.score, 0),
      fairOdds: number(recommendation.fairOdds),
      minimumEvOdds: number(recommendation.minimumEvOdds),
      evPriceGateOpen: recommendation.evPriceGateOpen === true,
      edge: number(recommendation.edge, 0),
      ev: number(recommendation.ev, 0),
      confidence: number(recommendation.confidence, 0),
      trustScore: number(recommendation.trustScore, 0),
      bookmaker: text(recommendation.bookmaker, 100) || null,
      bookmakerCount: Math.max(0, Math.trunc(number(recommendation.bookmakerCount, 0))),
      readiness: text(recommendation.readiness, 40) || "market-only",
      nearPlay: recommendation.intelligenceV2?.nearPlay === true,
      nearPlayGate: text(recommendation.intelligenceV2?.nearPlayGate, 80) || null,
      nextGate: recommendation.nextGate || null,
      paperOnly: true,
      realMoneyActionAvailable: false
    }
  };
}

export function reconcileAutoWatchRows({ existingRows = [], recommendations = [], preferences = {}, userId } = {}) {
  const prefs = normalizedAutoWatchPreferences(preferences);
  const existing = Array.isArray(existingRows) ? existingRows : [];
  const desiredRecommendations = selectAutoWatchRecommendations(recommendations, prefs);
  const desiredRows = desiredRecommendations
    .map((item) => buildAutoWatchRow(item, prefs, userId))
    .filter(Boolean);

  const existingByKey = new Map(existing.map((item) => [autoWatchSelectionKey(item), item]));
  const desiredByKey = new Map(desiredRows.map((item) => [autoWatchSelectionKey(item), item]));

  const inserts = [];
  let coveredByManual = 0;
  for (const [key, row] of desiredByKey) {
    const current = existingByKey.get(key);
    if (!current) {
      inserts.push(row);
      continue;
    }
    if (!isAutoManagedWatchlistItem(current)) coveredByManual += 1;
  }

  const deleteIds = existing
    .filter(isAutoManagedWatchlistItem)
    .filter((item) => !desiredByKey.has(autoWatchSelectionKey(item)))
    .map((item) => item.id)
    .filter(Boolean);

  const retainedAuto = existing
    .filter(isAutoManagedWatchlistItem)
    .filter((item) => desiredByKey.has(autoWatchSelectionKey(item))).length;

  return {
    version: AUTO_WATCH_VERSION,
    enabled: prefs.enabled,
    requested: desiredRows.length,
    inserts,
    deleteIds,
    retainedAuto,
    coveredByManual,
    desiredKeys: [...desiredByKey.keys()],
    filters: {
      selectionMode: prefs.selectionMode,
      minScore: prefs.minScore,
      minEdge: prefs.minEdge,
      minEv: prefs.minEv,
      sportKeys: prefs.sportKeys,
      topN: prefs.topN
    },
    paperOnly: true,
    realMoneyActionAvailable: false
  };
}
