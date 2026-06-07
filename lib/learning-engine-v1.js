export function buildLearningRecord({ pick = {}, result = null, clv = null }) {
  const stake = Number(pick.suggestedStake || pick.stake || 0);
  const odds = Number(pick.odds || 0);
  const outcome = normalizeResult(result);

  const profit = calculateProfit({ outcome, stake, odds });
  const roi = stake > 0 ? profit / stake : 0;

  return {
    id: pick.id || `${pick.gameId || pick.match}-${pick.selection}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    gameId: pick.gameId || null,
    match: pick.match || `${pick.homeTeam || ""} vs ${pick.awayTeam || ""}`.trim(),
    homeTeam: pick.homeTeam || null,
    awayTeam: pick.awayTeam || null,
    league: pick.league || pick.leagueTitle || pick.sportKey || null,
    marketKey: pick.marketKey || "h2h",
    selection: pick.selection || null,
    bookmaker: pick.bookmaker || null,
    odds,
    stake,
    decision: pick.decision || "WATCH",
    finalScore: Number(pick.finalScore || 0),
    edge: Number(pick.edge || 0),
    qualityGrade: pick.qualityGrade || "N/A",
    qualityScore: Number(pick.qualityScore || 0),
    sourceTrust: Number(pick.sourceTrust || 0),
    sentimentScore: Number(pick.sentimentScore || 0),
    promotionScore: Number(pick.promotionScore || 0),
    result: outcome,
    profit,
    roi,
    clvPercent: Number(clv?.clvPercent || pick.clvPercent || 0),
    clvGrade: clv?.grade || pick.clvGrade || "N/A"
  };
}

export function summarizeLearningRecords(records = []) {
  const settled = records.filter((item) => ["win", "loss", "push"].includes(item.result));
  const totalStake = settled.reduce((sum, item) => sum + Number(item.stake || 0), 0);
  const totalProfit = settled.reduce((sum, item) => sum + Number(item.profit || 0), 0);
  const wins = settled.filter((item) => item.result === "win").length;
  const losses = settled.filter((item) => item.result === "loss").length;
  const pushes = settled.filter((item) => item.result === "push").length;

  const roi = totalStake > 0 ? totalProfit / totalStake : 0;
  const hitRate = wins + losses > 0 ? wins / (wins + losses) : 0;
  const averageCLV = settled.length
    ? settled.reduce((sum, item) => sum + Number(item.clvPercent || 0), 0) / settled.length
    : 0;

  return {
    count: records.length,
    settled: settled.length,
    wins,
    losses,
    pushes,
    totalStake: round(totalStake),
    totalProfit: round(totalProfit),
    roi,
    hitRate,
    averageCLV,
    grade: gradeLearning({ roi, hitRate, averageCLV }),
    note: buildLearningNote({ roi, hitRate, averageCLV, settled: settled.length })
  };
}

export function buildAdaptiveWeights(records = []) {
  const summary = summarizeLearningRecords(records);

  return {
    edgeWeight: summary.roi > 0.05 ? 1.1 : summary.roi < -0.05 ? 0.9 : 1,
    qualityWeight: summary.averageCLV > 1 ? 1.1 : summary.averageCLV < -1 ? 0.9 : 1,
    trustWeight: summary.hitRate > 0.55 ? 1.05 : summary.hitRate < 0.45 ? 0.95 : 1,
    riskMode: summary.roi < -0.08 ? "defensive" : summary.roi > 0.08 ? "aggressive" : "balanced",
    summary
  };
}

function normalizeResult(result) {
  const value = String(result || "pending").toLowerCase();
  if (["win", "won", "w"].includes(value)) return "win";
  if (["loss", "lost", "l"].includes(value)) return "loss";
  if (["push", "void", "refund"].includes(value)) return "push";
  return "pending";
}

function calculateProfit({ outcome, stake, odds }) {
  if (outcome === "win") return stake * Math.max(0, odds - 1);
  if (outcome === "loss") return -stake;
  return 0;
}

function gradeLearning({ roi, hitRate, averageCLV }) {
  if (roi >= 0.08 && averageCLV > 1 && hitRate >= 0.52) return "A";
  if (roi >= 0.03 && averageCLV >= 0) return "B";
  if (roi > -0.03) return "C";
  if (roi > -0.08) return "D";
  return "F";
}

function buildLearningNote({ roi, hitRate, averageCLV, settled }) {
  if (settled < 20) return "Sample size is still small. Use paper tracking only.";
  if (roi > 0.05 && averageCLV > 0) return "Model is showing positive ROI and positive CLV.";
  if (roi < -0.05) return "Model is underperforming. Reduce exposure and review weights.";
  return "Model performance is neutral. Keep collecting data.";
}

function round(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}
