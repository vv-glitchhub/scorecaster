function finite(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function text(value, maximum = 180) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function timestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function decision(value) {
  const normalized = text(value, 20).toUpperCase();
  if (normalized === "PLAY") return "PLAY";
  if (normalized === "SKIP") return "SKIP";
  if (normalized === "CAUTION") return "CAUTION";
  return "WATCH";
}

function normalizedPoint(row = {}) {
  const odds = finite(row.odds);
  const capturedAt = timestamp(row.captured_at || row.capturedAt);
  if (odds === null || odds <= 1 || capturedAt === null) return null;
  const consensusProbability = finite(row.consensus_probability ?? row.consensusProbability);
  return {
    id: text(row.id, 100),
    watchlistId: text(row.watchlist_id || row.watchlistId, 100),
    eventId: text(row.event_id || row.eventId, 180),
    sport: text(row.sport, 120),
    league: text(row.league, 120),
    market: text(row.market || "h2h", 40),
    selection: text(row.selection, 160),
    odds,
    impliedProbability: 1 / odds,
    decision: decision(row.decision),
    consensusProbability: consensusProbability !== null && consensusProbability > 0 && consensusProbability < 1 ? consensusProbability : null,
    edge: finite(row.edge),
    ev: finite(row.ev),
    confidence: finite(row.confidence),
    bookmaker: text(row.bookmaker, 100),
    source: text(row.source, 80) || "server-top-picks",
    capturedAt: new Date(capturedAt).toISOString(),
    timestamp: capturedAt
  };
}

function percentageChange(current, initial) {
  return initial > 0 ? current / initial - 1 : null;
}

function movementLabel(change, epsilon = 0.0025) {
  if (change === null || Math.abs(change) < epsilon) return "stable";
  return change < 0 ? "shortened" : "lengthened";
}

export function buildMarketTimeline(rows = []) {
  const points = (Array.isArray(rows) ? rows : [])
    .map(normalizedPoint)
    .filter(Boolean)
    .sort((left, right) => left.timestamp - right.timestamp)
    .slice(-200);

  if (!points.length) {
    return {
      version: "market-timeline-v1",
      status: "empty",
      points: [],
      summary: {
        count: 0,
        initialOdds: null,
        currentOdds: null,
        minimumOdds: null,
        maximumOdds: null,
        oddsChange: null,
        impliedProbabilityChange: null,
        movement: "unknown",
        decisionChanges: 0,
        bookmakerChanges: 0,
        spanHours: 0
      },
      interpretation: "No verified price snapshots are available yet.",
      outcomeInference: false,
      sharpMoneyInference: false
    };
  }

  const first = points[0];
  const last = points.at(-1);
  const minimumOdds = Math.min(...points.map((point) => point.odds));
  const maximumOdds = Math.max(...points.map((point) => point.odds));
  const oddsChange = percentageChange(last.odds, first.odds);
  const probabilityChange = last.impliedProbability - first.impliedProbability;
  let decisionChanges = 0;
  let bookmakerChanges = 0;
  for (let index = 1; index < points.length; index += 1) {
    if (points[index].decision !== points[index - 1].decision) decisionChanges += 1;
    if (points[index].bookmaker && points[index - 1].bookmaker && points[index].bookmaker !== points[index - 1].bookmaker) bookmakerChanges += 1;
  }
  const movement = movementLabel(oddsChange);
  const interpretation = movement === "shortened"
    ? `The verified available price shortened from ${first.odds.toFixed(2)} to ${last.odds.toFixed(2)}.`
    : movement === "lengthened"
      ? `The verified available price lengthened from ${first.odds.toFixed(2)} to ${last.odds.toFixed(2)}.`
      : `The verified available price is broadly stable around ${last.odds.toFixed(2)}.`;

  return {
    version: "market-timeline-v1",
    status: points.length >= 2 ? "ready" : "single-point",
    eventId: last.eventId,
    sport: last.sport,
    league: last.league,
    market: last.market,
    selection: last.selection,
    points: points.map(({ timestamp: _timestamp, ...point }) => point),
    summary: {
      count: points.length,
      initialOdds: first.odds,
      currentOdds: last.odds,
      minimumOdds,
      maximumOdds,
      oddsChange,
      initialImpliedProbability: first.impliedProbability,
      currentImpliedProbability: last.impliedProbability,
      impliedProbabilityChange: probabilityChange,
      movement,
      decisionChanges,
      bookmakerChanges,
      firstCapturedAt: first.capturedAt,
      lastCapturedAt: last.capturedAt,
      spanHours: Math.max(0, (last.timestamp - first.timestamp) / 3600000)
    },
    interpretation,
    limitation: "Price movement is descriptive market history. It is not evidence of sharp money, inside information or the event outcome.",
    outcomeInference: false,
    sharpMoneyInference: false
  };
}

export function currentSnapshotFromPick(pick = {}, watchlist = {}, capturedAt = new Date().toISOString()) {
  const odds = finite(pick.odds);
  if (odds === null || odds <= 1) return null;
  const consensus = finite(pick.consensusProbability ?? pick.modelProbability);
  return {
    user_id: watchlist.user_id,
    watchlist_id: watchlist.id,
    event_id: text(pick.gameId || pick.eventId || pick.id, 180),
    sport: text(pick.sportKey || pick.league || watchlist.sport, 120),
    league: text(pick.leagueTitle || pick.league || watchlist.league, 120),
    market: text(pick.marketKey || pick.market || watchlist.market || "h2h", 40),
    selection: text(pick.selection || pick.label, 160),
    odds,
    decision: decision(pick.productDecision || pick.decision),
    consensus_probability: consensus !== null && consensus > 0 && consensus < 1 ? consensus : null,
    edge: finite(pick.edge),
    ev: finite(pick.ev),
    confidence: finite(pick.confidence),
    bookmaker: text(pick.bookmaker, 100),
    source: "server-top-picks",
    captured_at: capturedAt
  };
}

export function initialSnapshotFromWatchlist(watchlist = {}) {
  const odds = finite(watchlist.added_odds);
  if (odds === null || odds <= 1) return null;
  const raw = watchlist.raw_pick && typeof watchlist.raw_pick === "object" ? watchlist.raw_pick : {};
  const consensus = finite(raw.consensusProbability);
  return {
    user_id: watchlist.user_id,
    watchlist_id: watchlist.id,
    event_id: text(watchlist.event_id, 180),
    sport: text(watchlist.sport, 120),
    league: text(watchlist.league, 120),
    market: text(watchlist.market || "h2h", 40),
    selection: text(watchlist.selection, 160),
    odds,
    decision: decision(watchlist.added_decision),
    consensus_probability: consensus !== null && consensus > 0 && consensus < 1 ? consensus : null,
    edge: finite(raw.edge),
    ev: finite(raw.ev),
    confidence: finite(raw.confidence),
    bookmaker: text(raw.bookmaker, 100),
    source: "watchlist-added",
    captured_at: watchlist.created_at || new Date().toISOString()
  };
}

export function materiallyDifferentSnapshot(left = {}, right = {}) {
  if (!left || !right) return true;
  if (Math.abs(finite(left.odds, 0) - finite(right.odds, 0)) >= 0.005) return true;
  if (decision(left.decision) !== decision(right.decision)) return true;
  if (text(left.bookmaker, 100) !== text(right.bookmaker, 100)) return true;
  const leftConsensus = finite(left.consensus_probability ?? left.consensusProbability);
  const rightConsensus = finite(right.consensus_probability ?? right.consensusProbability);
  if (leftConsensus !== null && rightConsensus !== null && Math.abs(leftConsensus - rightConsensus) >= 0.0025) return true;
  return false;
}
