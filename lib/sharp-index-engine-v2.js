export function buildSharpIndexV2({ clv = null, movement = null, picks = [] } = {}) {
  const clvRecords = Array.isArray(clv?.records) ? clv.records : [];
  const movements = Array.isArray(movement?.movements) ? movement.movements : [];
  const safePicks = Array.isArray(picks) ? picks : [];

  const pickIndexes = safePicks.map((pick) => calculatePickSharpIndex({ pick, clvRecords, movements }));

  return {
    ok: true,
    source: "sharp-index-engine-v2",
    generatedAt: new Date().toISOString(),
    summary: summarizeSharpIndexes(pickIndexes),
    strongestSignals: pickIndexes.filter((item) => item.label === "Strong Signal").slice(0, 10),
    watchSignals: pickIndexes.filter((item) => item.label === "Watch").slice(0, 10),
    weakSignals: pickIndexes.filter((item) => item.label === "Weak" || item.label === "Avoid").slice(0, 10),
    picks: pickIndexes
  };
}

function calculatePickSharpIndex({ pick, clvRecords, movements }) {
  const key = buildKey({
    game_id: pick.gameId || pick.id,
    market_key: pick.marketKey || pick.market,
    selection: pick.selection,
    bookmaker: pick.bookmaker
  });

  const clvRecord = clvRecords.find((record) => buildKey(record) === key) || null;
  const movement = movements.find((record) => buildKey(record) === key) || null;

  const clvScore = scoreCLV(clvRecord);
  const movementScore = scoreMovement(movement);
  const pressureScore = scorePressure(movement?.pressure);
  const trustScore = clamp(Number(pick.sourceTrust || 0) * 20, 0, 20);
  const edgeScore = clamp(Number(pick.edge || 0) * 140, 0, 14);
  const contextScore = clamp(Number(pick.matchContextScore || 0) * 80, -8, 8);

  const rawScore = 45 + clvScore + movementScore + pressureScore + trustScore + edgeScore + contextScore;
  const sharpIndex = clamp(rawScore, 0, 100);
  const label = classifySharpIndex(sharpIndex);

  return {
    id: pick.id || pick.gameId || null,
    match: pick.match || `${pick.homeTeam || ""} vs ${pick.awayTeam || ""}`.trim(),
    league: pick.league || pick.leagueTitle || pick.sportTitle || pick.sportKey || "Unknown",
    marketKey: pick.marketKey || pick.market || "Unknown",
    selection: pick.selection,
    bookmaker: pick.bookmaker,
    odds: pick.odds,
    decision: pick.decision,
    finalScore100: Number(pick.finalScore100 || 0),
    sharpIndex,
    label,
    components: {
      clvScore,
      movementScore,
      pressureScore,
      trustScore,
      edgeScore,
      contextScore
    },
    signals: {
      clvGrade: clvRecord?.clvGrade || "N/A",
      clvPercent: Number(clvRecord?.clvPercent || 0),
      movementSignal: movement?.signal || "none",
      pressure: movement?.pressure || "neutral",
      movementConfidence: Number(movement?.confidence || 0),
      movementPercent: Number(movement?.movementPercent || 0)
    },
    notes: buildSharpNotes({ clvRecord, movement, sharpIndex, label })
  };
}

function scoreCLV(record) {
  if (!record) return 0;
  const value = Number(record.clvPercent || 0);
  return clamp(value * 2.2, -18, 18);
}

function scoreMovement(movement) {
  if (!movement) return 0;
  const confidence = Number(movement.confidence || 0);
  if (movement.signal === "steam_move") return 16 * confidence;
  if (movement.signal === "reverse_line_move") return 10 * confidence;
  if (movement.signal === "market_move") return 6 * confidence;
  return 0;
}

function scorePressure(pressure) {
  if (pressure === "heavy_positive") return 10;
  if (pressure === "positive") return 5;
  if (pressure === "heavy_negative") return -10;
  if (pressure === "negative") return -5;
  return 0;
}

function summarizeSharpIndexes(items) {
  return {
    count: items.length,
    averageSharpIndex: average(items.map((item) => item.sharpIndex)),
    strongSignals: items.filter((item) => item.label === "Strong Signal").length,
    positiveSignals: items.filter((item) => item.label === "Positive").length,
    watchSignals: items.filter((item) => item.label === "Watch").length,
    weakSignals: items.filter((item) => item.label === "Weak" || item.label === "Avoid").length
  };
}

function classifySharpIndex(value) {
  if (value >= 82) return "Strong Signal";
  if (value >= 72) return "Positive";
  if (value >= 60) return "Watch";
  if (value >= 45) return "Weak";
  return "Avoid";
}

function buildSharpNotes({ clvRecord, movement, sharpIndex, label }) {
  const notes = [`Sharp index ${sharpIndex.toFixed(1)} / 100 (${label}).`];
  if (clvRecord?.clvPercent > 1) notes.push("Positive CLV supports this profile.");
  if (clvRecord?.clvPercent < -1) notes.push("Negative CLV reduces confidence.");
  if (movement?.signal === "steam_move") notes.push("Steam-style market movement detected.");
  if (movement?.signal === "reverse_line_move") notes.push("Reverse line movement detected.");
  if (movement?.pressure?.includes("heavy")) notes.push(`Heavy market pressure: ${movement.pressure}.`);
  return notes;
}

function buildKey(item = {}) {
  return [
    item.game_id || item.gameId || item.id || "",
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
