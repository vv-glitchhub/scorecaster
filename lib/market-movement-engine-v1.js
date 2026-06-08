export function buildMarketMovementAnalysis({ closingLines = [], picks = [] } = {}) {
  const records = Array.isArray(closingLines) ? closingLines : [];
  const grouped = groupByMarket(records);
  const movements = Array.from(grouped.values()).map((group) => analyzeMarketGroup(group));

  return {
    ok: true,
    source: "market-movement-engine-v1",
    generatedAt: new Date().toISOString(),
    summary: summarizeMovements(movements),
    steamMoves: movements.filter((item) => item.signal === "steam_move"),
    reverseMoves: movements.filter((item) => item.signal === "reverse_line_move"),
    pressureMoves: movements.filter((item) => item.pressure !== "neutral"),
    pickSignals: attachMovementSignals({ picks, movements }),
    movements
  };
}

function groupByMarket(records) {
  const grouped = new Map();

  for (const record of records) {
    const key = buildMarketKey(record);
    const group = grouped.get(key) || [];
    group.push(record);
    grouped.set(key, group);
  }

  return grouped;
}

function analyzeMarketGroup(group = []) {
  const sorted = [...group].sort((a, b) => new Date(a.created_at || a.createdAt || 0) - new Date(b.created_at || b.createdAt || 0));
  const first = sorted[0] || {};
  const last = sorted[sorted.length - 1] || {};

  const openingOdds = Number(first.opening_odds || first.openingOdds || first.current_odds || first.currentOdds || 0);
  const latestOdds = Number(last.current_odds || last.currentOdds || last.closing_odds || last.closingOdds || openingOdds || 0);
  const closingOdds = Number(last.closing_odds || last.closingOdds || 0);
  const movementPercent = calculateMovementPercent(openingOdds, latestOdds || closingOdds);
  const velocity = sorted.length > 1 ? movementPercent / Math.max(hoursBetween(first, last), 1) : 0;
  const signal = classifySignal({ movementPercent, velocity, count: sorted.length });
  const pressure = classifyPressure(movementPercent);

  return {
    key: buildMarketKey(first),
    gameId: first.game_id || first.gameId || null,
    sportKey: first.sport_key || first.sportKey || null,
    league: first.league || null,
    marketKey: first.market_key || first.marketKey || null,
    selection: first.selection || null,
    bookmaker: first.bookmaker || null,
    count: sorted.length,
    openingOdds,
    latestOdds,
    closingOdds,
    movementPercent,
    velocity,
    signal,
    pressure,
    confidence: calculateConfidence({ movementPercent, velocity, count: sorted.length }),
    timeline: sorted.map((item) => ({
      createdAt: item.created_at || item.createdAt || null,
      odds: Number(item.current_odds || item.currentOdds || item.closing_odds || item.closingOdds || 0),
      movement: Number(item.movement || 0)
    }))
  };
}

function attachMovementSignals({ picks = [], movements = [] }) {
  return (Array.isArray(picks) ? picks : []).map((pick) => {
    const key = buildMarketKey({
      game_id: pick.gameId || pick.id,
      market_key: pick.marketKey || pick.market,
      selection: pick.selection,
      bookmaker: pick.bookmaker
    });
    const movement = movements.find((item) => item.key === key) || null;

    return {
      id: pick.id || pick.gameId || null,
      match: pick.match || `${pick.homeTeam || ""} vs ${pick.awayTeam || ""}`.trim(),
      selection: pick.selection,
      decision: pick.decision,
      movementSignal: movement?.signal || "none",
      pressure: movement?.pressure || "neutral",
      confidence: movement?.confidence || 0,
      movementPercent: movement?.movementPercent || 0
    };
  });
}

function summarizeMovements(movements) {
  return {
    count: movements.length,
    steamMoves: movements.filter((item) => item.signal === "steam_move").length,
    reverseMoves: movements.filter((item) => item.signal === "reverse_line_move").length,
    heavyPressure: movements.filter((item) => item.pressure === "heavy_positive" || item.pressure === "heavy_negative").length,
    averageMovement: average(movements.map((item) => item.movementPercent)),
    averageConfidence: average(movements.map((item) => item.confidence))
  };
}

function classifySignal({ movementPercent, velocity, count }) {
  const absMove = Math.abs(Number(movementPercent || 0));
  const absVelocity = Math.abs(Number(velocity || 0));

  if (count >= 2 && absMove >= 0.04 && absVelocity >= 0.01) return "steam_move";
  if (count >= 2 && absMove >= 0.025 && absVelocity < 0.004) return "reverse_line_move";
  if (absMove >= 0.02) return "market_move";
  return "stable";
}

function classifyPressure(movementPercent) {
  const value = Number(movementPercent || 0);
  if (value >= 0.05) return "heavy_positive";
  if (value >= 0.02) return "positive";
  if (value <= -0.05) return "heavy_negative";
  if (value <= -0.02) return "negative";
  return "neutral";
}

function calculateConfidence({ movementPercent, velocity, count }) {
  const moveScore = Math.min(Math.abs(Number(movementPercent || 0)) / 0.06, 1) * 0.55;
  const velocityScore = Math.min(Math.abs(Number(velocity || 0)) / 0.02, 1) * 0.25;
  const sampleScore = Math.min(Number(count || 0) / 5, 1) * 0.2;
  return moveScore + velocityScore + sampleScore;
}

function calculateMovementPercent(openingOdds, latestOdds) {
  const opening = Number(openingOdds || 0);
  const latest = Number(latestOdds || 0);
  if (!opening || !latest || opening <= 1 || latest <= 1) return 0;
  return (latest - opening) / opening;
}

function hoursBetween(first, last) {
  const start = new Date(first.created_at || first.createdAt || 0).getTime();
  const end = new Date(last.created_at || last.createdAt || 0).getTime();
  if (!start || !end || end <= start) return 1;
  return (end - start) / 36e5;
}

function buildMarketKey(item = {}) {
  return [
    item.game_id || item.gameId || "",
    item.market_key || item.marketKey || item.market || "",
    item.selection || "",
    item.bookmaker || ""
  ].join("::").toLowerCase();
}

function average(values = []) {
  const clean = values.map(Number).filter(Number.isFinite);
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}
