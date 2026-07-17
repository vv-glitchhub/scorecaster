const HOUR_MS = 60 * 60 * 1000;

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value) {
  return String(value || "").trim();
}

function eventId(item = {}) {
  return text(item.event_id || item.eventId || item.gameId || item.id);
}

function selectionKey(item = {}) {
  return `${eventId(item)}::${text(item.market || item.marketKey || "h2h").toLowerCase()}::${text(item.selection || item.label).toLowerCase()}`;
}

function normalizedDecision(item = {}) {
  const value = text(item.productDecision || item.decision || item.added_decision).toUpperCase();
  if (value === "PLAY") return "PLAY";
  if (value === "SKIP") return "SKIP";
  if (value === "CAUTION") return "CAUTION";
  return "WATCH";
}

function kickoff(item = {}) {
  const timestamp = Date.parse(String(item.commence_time || item.commenceTime || ""));
  return Number.isFinite(timestamp) ? timestamp : null;
}

function alert(id, type, severity, title, message, item, details = {}) {
  return {
    id,
    type,
    severity,
    title,
    message,
    watchlistId: item.id,
    eventId: item.event_id,
    selection: item.selection,
    match: item.match,
    commenceTime: item.commence_time,
    ...details
  };
}

export function buildWatchlistState({ items = [], currentPicks = [], now = Date.now() } = {}) {
  const currentByKey = new Map(
    (Array.isArray(currentPicks) ? currentPicks : []).map((pick) => [selectionKey(pick), pick])
  );

  const resolved = (Array.isArray(items) ? items : []).map((item) => {
    const current = currentByKey.get(selectionKey(item)) || null;
    const alerts = [];
    const addedOdds = number(item.added_odds);
    const currentOdds = number(current?.odds);
    const moveThreshold = Math.max(0.005, Math.min(0.5, number(item.alert_move_percent, 0.05)));
    const kickoffAt = kickoff(item);
    const minutesToKickoff = kickoffAt === null ? null : (kickoffAt - now) / 60000;
    const addedDecision = normalizedDecision(item);
    const currentDecision = current ? normalizedDecision(current) : null;
    const consensusProbability = number(current?.consensusProbability ?? current?.modelProbability);
    const minimumPlayOdds = consensusProbability > 0 && consensusProbability < 1
      ? 1.03 / consensusProbability
      : null;
    const oddsMove = addedOdds > 1 && currentOdds > 1 ? (currentOdds - addedOdds) / addedOdds : null;

    if (minutesToKickoff !== null && minutesToKickoff > 0 && minutesToKickoff <= number(item.alert_before_minutes, 120)) {
      alerts.push(alert(
        `${item.id}-kickoff-soon`,
        "kickoff_soon",
        minutesToKickoff <= 30 ? "high" : "medium",
        "Kickoff is approaching",
        `The watched fixture starts in approximately ${Math.max(1, Math.round(minutesToKickoff))} minutes.`,
        item,
        { minutesToKickoff: Math.max(0, Math.round(minutesToKickoff)) }
      ));
    }

    if (current && currentDecision !== addedDecision) {
      const weakened = addedDecision === "PLAY" && currentDecision !== "PLAY";
      alerts.push(alert(
        `${item.id}-decision-${currentDecision}`,
        "decision_changed",
        weakened ? "high" : "medium",
        "Scorecaster decision changed",
        `The decision changed from ${addedDecision} to ${currentDecision}.`,
        item,
        { addedDecision, currentDecision }
      ));
    }

    if (oddsMove !== null && Math.abs(oddsMove) >= moveThreshold) {
      alerts.push(alert(
        `${item.id}-price-move`,
        "price_moved",
        Math.abs(oddsMove) >= moveThreshold * 2 ? "high" : "medium",
        "Tracked price moved",
        `The available price moved from ${addedOdds.toFixed(2)} to ${currentOdds.toFixed(2)}.`,
        item,
        { addedOdds, currentOdds, oddsMove }
      ));
    }

    if (currentOdds > 1 && minimumPlayOdds && currentOdds < minimumPlayOdds) {
      alerts.push(alert(
        `${item.id}-below-play-floor`,
        "below_play_price",
        "high",
        "Price no longer meets the PLAY floor",
        `Current odds ${currentOdds.toFixed(2)} are below the calculated PLAY floor ${minimumPlayOdds.toFixed(2)}.`,
        item,
        { currentOdds, minimumPlayOdds }
      ));
    }

    if (!current && minutesToKickoff !== null && minutesToKickoff > -120) {
      alerts.push(alert(
        `${item.id}-market-unavailable`,
        "market_unavailable",
        "info",
        "Current market is unavailable",
        "The live provider did not return a matching current market. No replacement data was invented.",
        item
      ));
    }

    if (kickoffAt !== null && kickoffAt < now - 2 * HOUR_MS) {
      alerts.push(alert(
        `${item.id}-fixture-passed`,
        "fixture_passed",
        "info",
        "Fixture has passed the watch window",
        "The scheduled start time has passed. Result tracking remains separate from watchlist alerts.",
        item
      ));
    }

    return {
      ...item,
      current: current ? {
        odds: currentOdds,
        decision: currentDecision,
        edge: number(current.edge),
        ev: number(current.ev),
        confidence: number(current.confidence),
        trustScore: number(current.trustScore),
        bookmaker: text(current.bookmaker),
        generatedAt: current.generatedAt || null,
        minimumPlayOdds
      } : null,
      oddsMove,
      minutesToKickoff,
      alerts
    };
  });

  const alerts = resolved
    .flatMap((item) => item.alerts)
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

  return {
    items: resolved,
    alerts,
    summary: {
      watched: resolved.length,
      active: resolved.filter((item) => item.active !== false).length,
      alerts: alerts.length,
      high: alerts.filter((item) => item.severity === "high").length,
      medium: alerts.filter((item) => item.severity === "medium").length,
      info: alerts.filter((item) => item.severity === "info").length
    }
  };
}

function severityRank(value) {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}
