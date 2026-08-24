export const AUTO_WATCH_SOURCE = "scorecaster-auto-watch-recommendations-v1";

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

export function normalizedAutoWatchPreferences(input = {}) {
  return {
    enabled: input.enabled === true,
    topN: Math.trunc(clamp(input.top_n ?? input.topN, 1, 3, 3)),
    alertMovePercent: clamp(input.alert_move_percent ?? input.alertMovePercent, 0.005, 0.5, 0.03),
    alertBeforeMinutes: Math.trunc(clamp(input.alert_before_minutes ?? input.alertBeforeMinutes, 15, 10080, 120))
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

function validRecommendation(item = {}) {
  const kickoff = Date.parse(String(item.commenceTime || ""));
  const odds = number(item.odds);
  const decision = text(item.decision || item.productDecision, 20).toUpperCase();
  return Boolean(
    text(item.eventId || item.gameId || item.id, 180) &&
    text(item.selection || item.label, 160) &&
    text(item.sportKey || item.sport, 120) &&
    Number.isFinite(kickoff) &&
    odds !== null && odds > 1 &&
    (decision === "PLAY" || decision === "CAUTION")
  );
}

export function selectAutoWatchRecommendations(recommendations = [], preferences = {}) {
  const prefs = normalizedAutoWatchPreferences(preferences);
  if (!prefs.enabled) return [];
  return (Array.isArray(recommendations) ? recommendations : [])
    .filter(validRecommendation)
    .slice(0, prefs.topN);
}

export function buildAutoWatchRow(recommendation = {}, preferences = {}, userId) {
  const prefs = normalizedAutoWatchPreferences(preferences);
  if (!userId || !validRecommendation(recommendation)) return null;
  const commenceTime = new Date(recommendation.commenceTime);
  const decision = text(recommendation.decision || recommendation.productDecision, 20).toUpperCase();
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
      autoWatchRank: rank,
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
    enabled: prefs.enabled,
    requested: desiredRows.length,
    inserts,
    deleteIds,
    retainedAuto,
    coveredByManual,
    desiredKeys: [...desiredByKey.keys()]
  };
}
