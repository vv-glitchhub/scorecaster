export function buildHistoricalOddsSnapshot({
  gameId,
  homeTeam,
  awayTeam,
  league,
  marketKey = "h2h",
  bookmaker,
  selection,
  odds,
  timestamp = new Date().toISOString()
}) {
  return {
    id: `${gameId || `${homeTeam}-${awayTeam}`}-${marketKey}-${selection}-${timestamp}`,
    gameId: gameId || `${homeTeam}-${awayTeam}`,
    homeTeam,
    awayTeam,
    league,
    marketKey,
    bookmaker,
    selection,
    odds: Number(odds || 0),
    impliedProbability: odds > 0 ? 1 / Number(odds) : 0,
    timestamp
  };
}

export function analyzeHistoricalOddsMovement({ snapshots = [], selection }) {
  const filtered = snapshots
    .filter((item) => !selection || item.selection === selection)
    .filter((item) => Number(item.odds || 0) > 1)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  if (filtered.length < 2) {
    return {
      ok: true,
      source: "historical-odds-engine-v1",
      movement: "insufficient_data",
      movementScore: 0,
      openingOdds: null,
      latestOdds: null,
      changePercent: 0,
      notes: ["Not enough odds history yet."]
    };
  }

  const opening = filtered[0];
  const latest = filtered[filtered.length - 1];
  const openingOdds = Number(opening.odds || 0);
  const latestOdds = Number(latest.odds || 0);
  const changePercent = ((latestOdds - openingOdds) / openingOdds) * 100;
  const impliedChange = Number(latest.impliedProbability || 0) - Number(opening.impliedProbability || 0);

  return {
    ok: true,
    source: "historical-odds-engine-v1",
    movement: classifyMovement(changePercent),
    movementScore: calculateMovementScore(changePercent, impliedChange),
    openingOdds,
    latestOdds,
    changePercent,
    impliedChange,
    sampleSize: filtered.length,
    firstSeen: opening.timestamp,
    lastSeen: latest.timestamp,
    notes: buildMovementNotes(changePercent, impliedChange)
  };
}

export function analyzeMarketMovementForPicks({ picks = [], history = [] }) {
  return picks.map((pick) => {
    const gameId = pick.gameId || `${pick.homeTeam}-${pick.awayTeam}`;
    const snapshots = history.filter((item) =>
      item.gameId === gameId &&
      item.marketKey === (pick.marketKey || "h2h") &&
      item.selection === pick.selection
    );

    const movement = analyzeHistoricalOddsMovement({
      snapshots,
      selection: pick.selection
    });

    return {
      ...pick,
      historicalMovement: movement,
      movementSignal: movement.movement,
      movementScore: movement.movementScore,
      finalScore: Number(pick.finalScore || 0) + Number(movement.movementScore || 0)
    };
  });
}

function classifyMovement(changePercent) {
  if (changePercent <= -8) return "strong_shortening";
  if (changePercent <= -3) return "shortening";
  if (changePercent >= 8) return "strong_drift";
  if (changePercent >= 3) return "drift";
  return "stable";
}

function calculateMovementScore(changePercent, impliedChange) {
  if (changePercent <= -8 || impliedChange >= 0.06) return 0.035;
  if (changePercent <= -3 || impliedChange >= 0.025) return 0.018;
  if (changePercent >= 8 || impliedChange <= -0.06) return -0.03;
  if (changePercent >= 3 || impliedChange <= -0.025) return -0.015;
  return 0;
}

function buildMovementNotes(changePercent, impliedChange) {
  const notes = [];

  if (changePercent < 0) {
    notes.push("Odds shortened from opening price.");
  } else if (changePercent > 0) {
    notes.push("Odds drifted from opening price.");
  } else {
    notes.push("Odds are stable.");
  }

  if (impliedChange > 0.03) {
    notes.push("Market implied probability increased.");
  }

  if (impliedChange < -0.03) {
    notes.push("Market implied probability decreased.");
  }

  return notes;
}
