export function buildAgentLearningV4({ records = [], clvSummary = null } = {}) {
  const cleanRecords = Array.isArray(records) ? records : [];
  const settled = cleanRecords.filter((record) => ["win", "loss", "push", "won", "lost"].includes(normalizeResult(record.result)));

  if (!settled.length) {
    return buildEmptyLearning(clvSummary);
  }

  const summary = summarizeRecords(settled, clvSummary);
  const weights = buildAdaptiveWeightsV4(summary);
  const leagueWeights = buildSegmentWeights(settled, "league");
  const marketWeights = buildSegmentWeights(settled, "marketKey");
  const bookmakerWeights = buildSegmentWeights(settled, "bookmaker");

  return {
    ok: true,
    source: "agent-learning-v4",
    version: "V4",
    generatedAt: new Date().toISOString(),
    summary,
    weights,
    leagueWeights,
    marketWeights,
    bookmakerWeights,
    recommendations: buildRecommendations(summary, weights)
  };
}

function buildEmptyLearning(clvSummary) {
  return {
    ok: true,
    source: "agent-learning-v4",
    version: "V4",
    generatedAt: new Date().toISOString(),
    summary: {
      total: 0,
      settled: 0,
      roi: 0,
      hitRate: 0,
      averageCLV: Number(clvSummary?.averageCLVPercent || 0),
      clvGrade: clvSummary?.grade || "N/A",
      riskMode: "balanced"
    },
    weights: {
      edgeWeight: 1,
      qualityWeight: 1,
      trustWeight: 1,
      clvWeight: 1,
      sharpWeight: 1,
      contextWeight: 1,
      riskMode: "balanced"
    },
    leagueWeights: [],
    marketWeights: [],
    bookmakerWeights: [],
    recommendations: ["Not enough settled records for Agent Learning V4."]
  };
}

function summarizeRecords(records, clvSummary) {
  const total = records.length;
  const wins = records.filter((record) => ["win", "won"].includes(normalizeResult(record.result))).length;
  const losses = records.filter((record) => ["loss", "lost"].includes(normalizeResult(record.result))).length;
  const pushes = records.filter((record) => normalizeResult(record.result) === "push").length;
  const profit = records.reduce((sum, record) => sum + Number(record.profit || 0), 0);
  const stake = records.reduce((sum, record) => sum + Number(record.stake || record.suggestedStake || 0), 0);
  const roi = stake > 0 ? profit / stake : average(records.map((record) => Number(record.roi || 0)));
  const hitRate = wins + losses > 0 ? wins / (wins + losses) : 0;
  const averageCLV = Number(clvSummary?.averageCLVPercent ?? average(records.map((record) => Number(record.clvPercent || 0))));
  const averageSharp = average(records.map((record) => Number(record.sharpMoneyScore || 0)));
  const averageContext = average(records.map((record) => Number(record.matchContextScore || 0)));
  const averageQuality = average(records.map((record) => Number(record.qualityScore || 0)));

  return {
    total,
    settled: total,
    wins,
    losses,
    pushes,
    profit,
    stake,
    roi,
    hitRate,
    averageCLV,
    clvGrade: clvSummary?.grade || gradeCLV(averageCLV),
    averageSharp,
    averageContext,
    averageQuality,
    riskMode: classifyRiskMode({ roi, hitRate, averageCLV })
  };
}

function buildAdaptiveWeightsV4(summary) {
  const roi = Number(summary.roi || 0);
  const hitRate = Number(summary.hitRate || 0);
  const clv = Number(summary.averageCLV || 0);
  const sharp = Number(summary.averageSharp || 0);
  const context = Number(summary.averageContext || 0);
  const quality = Number(summary.averageQuality || 0);

  return {
    edgeWeight: clamp(1 + roi * 0.75 + clv / 100, 0.75, 1.35),
    qualityWeight: clamp(1 + quality * 0.12 + (hitRate - 0.5) * 0.3, 0.75, 1.3),
    trustWeight: clamp(1 + (hitRate - 0.5) * 0.2, 0.85, 1.2),
    clvWeight: clamp(1 + clv / 20, 0.7, 1.4),
    sharpWeight: clamp(1 + sharp * 1.5, 0.75, 1.35),
    contextWeight: clamp(1 + context * 1.25, 0.75, 1.3),
    riskMode: summary.riskMode
  };
}

function buildSegmentWeights(records, key) {
  const groups = new Map();

  for (const record of records) {
    const value = record[key] || record.market || record.leagueTitle || "Unknown";
    const existing = groups.get(value) || [];
    existing.push(record);
    groups.set(value, existing);
  }

  return Array.from(groups.entries())
    .map(([name, group]) => {
      const wins = group.filter((record) => ["win", "won"].includes(normalizeResult(record.result))).length;
      const losses = group.filter((record) => ["loss", "lost"].includes(normalizeResult(record.result))).length;
      const stake = group.reduce((sum, record) => sum + Number(record.stake || record.suggestedStake || 0), 0);
      const profit = group.reduce((sum, record) => sum + Number(record.profit || 0), 0);
      const roi = stake > 0 ? profit / stake : average(group.map((record) => Number(record.roi || 0)));
      const hitRate = wins + losses > 0 ? wins / (wins + losses) : 0;
      const clv = average(group.map((record) => Number(record.clvPercent || 0)));

      return {
        name,
        count: group.length,
        roi,
        hitRate,
        averageCLV: clv,
        weight: clamp(1 + roi * 0.5 + clv / 50, 0.7, 1.3)
      };
    })
    .sort((a, b) => b.weight - a.weight);
}

function buildRecommendations(summary, weights) {
  const notes = [];

  if (summary.averageCLV > 1) notes.push("Positive CLV profile detected. Keep emphasizing price timing and line shopping.");
  if (summary.averageCLV < -1) notes.push("Negative CLV profile detected. Reduce confidence until price entry improves.");
  if (summary.roi < -0.05) notes.push("Negative ROI detected. Use defensive risk mode and smaller stakes.");
  if (summary.roi > 0.05) notes.push("Positive ROI detected. Current model profile is performing well, but keep sample size in mind.");
  if (weights.riskMode === "defensive") notes.push("Agent V4 recommends defensive staking.");
  if (!notes.length) notes.push("Learning profile is balanced. Continue collecting settled paper bets.");

  return notes;
}

function classifyRiskMode({ roi, hitRate, averageCLV }) {
  if (roi <= -0.08 || averageCLV <= -2 || hitRate < 0.42) return "defensive";
  if (roi >= 0.08 && averageCLV >= 1.5 && hitRate > 0.55) return "aggressive";
  return "balanced";
}

function normalizeResult(result) {
  const value = String(result || "").toLowerCase();
  if (value === "won") return "win";
  if (value === "lost") return "loss";
  return value;
}

function average(values = []) {
  const clean = values.map(Number).filter(Number.isFinite);
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function gradeCLV(value) {
  if (value >= 5) return "A+";
  if (value >= 3) return "A";
  if (value >= 1.5) return "B";
  if (value >= 0) return "C";
  if (value >= -1.5) return "D";
  return "F";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
