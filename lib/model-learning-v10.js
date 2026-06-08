export function buildModelLearningV10({ bets = [], results = [], clvHistory = [], sharpHistory = [] } = {}) {
  const joined = joinWarehouseRecords({ bets, results, clvHistory, sharpHistory });
  const summary = summarizeJoinedRecords(joined);
  const leagueProfiles = buildProfiles(joined, "league");
  const marketProfiles = buildProfiles(joined, "marketKey");
  const bookmakerProfiles = buildProfiles(joined, "bookmaker");
  const weights = buildWeights({ summary, leagueProfiles, marketProfiles, bookmakerProfiles });

  return {
    ok: true,
    source: "model-learning-v10",
    learningVersion: "V10",
    generatedAt: new Date().toISOString(),
    summary,
    weights,
    leagueProfiles,
    marketProfiles,
    bookmakerProfiles,
    recommendations: buildRecommendations({ summary, weights, leagueProfiles, marketProfiles })
  };
}

export function applyModelLearningV10ToPicks({ picks = [], learning = null } = {}) {
  const safePicks = Array.isArray(picks) ? picks : [];
  const profiles = {
    league: learning?.leagueProfiles || [],
    market: learning?.marketProfiles || [],
    bookmaker: learning?.bookmakerProfiles || []
  };

  return safePicks
    .map((pick) => {
      const baseScore = Number(pick.finalScore100 || 0);
      const leagueAdj = findProfileAdjustment(profiles.league, pick.league || pick.leagueTitle || pick.sportKey);
      const marketAdj = findProfileAdjustment(profiles.market, pick.marketKey || pick.market);
      const bookmakerAdj = findProfileAdjustment(profiles.bookmaker, pick.bookmaker);
      const riskAdj = learning?.weights?.riskMode === "defensive" ? -4 : learning?.weights?.riskMode === "growth" ? 2 : 0;
      const learnedScore100 = clamp(baseScore + leagueAdj + marketAdj + bookmakerAdj + riskAdj, 0, 100);

      return {
        ...pick,
        learningVersion: "V10",
        learnedScore100,
        finalScore100: learnedScore100,
        learnedGrade: gradeScore(learnedScore100),
        learningAdjustments: {
          leagueAdj,
          marketAdj,
          bookmakerAdj,
          riskAdj
        }
      };
    })
    .sort((a, b) => Number(b.finalScore100 || 0) - Number(a.finalScore100 || 0))
    .map((pick, index) => ({ ...pick, learnedRank: index + 1 }));
}

function joinWarehouseRecords({ bets, results, clvHistory, sharpHistory }) {
  const resultMap = new Map((Array.isArray(results) ? results : []).map((item) => [item.bet_id || item.betId || item.game_id || item.gameId, item]));
  const clvMap = new Map((Array.isArray(clvHistory) ? clvHistory : []).map((item) => [item.bet_id || item.betId || item.game_id || item.gameId, item]));
  const sharpMap = new Map((Array.isArray(sharpHistory) ? sharpHistory : []).map((item) => [item.bet_id || item.betId || item.game_id || item.gameId, item]));

  return (Array.isArray(bets) ? bets : []).map((bet) => {
    const key = bet.id || bet.game_id || bet.gameId;
    const result = resultMap.get(key) || resultMap.get(bet.game_id) || null;
    const clv = clvMap.get(key) || clvMap.get(bet.game_id) || null;
    const sharp = sharpMap.get(key) || sharpMap.get(bet.game_id) || null;

    return {
      id: bet.id,
      gameId: bet.game_id || bet.gameId,
      sportKey: bet.sport_key || bet.sportKey,
      league: bet.league || bet.sport_title || bet.sportTitle || "Unknown",
      marketKey: bet.market_key || bet.marketKey || bet.market || "Unknown",
      bookmaker: bet.bookmaker || "Unknown",
      selection: bet.selection,
      odds: Number(bet.odds || 0),
      stake: Number(bet.stake || 0),
      edge: Number(bet.edge || 0),
      ev: Number(bet.ev || 0),
      score: Number(bet.final_score_100 || bet.finalScore100 || bet.final_score || bet.finalScore || 0),
      decision: bet.decision,
      result: normalizeResult(result?.result),
      profit: Number(result?.profit || 0),
      roi: Number(result?.roi || 0),
      clvPercent: Number(clv?.clv_percent || clv?.clvPercent || 0),
      sharpIndex: Number(sharp?.sharp_index || sharp?.sharpIndex || 0)
    };
  });
}

function summarizeJoinedRecords(records) {
  const settled = records.filter((item) => ["win", "loss", "push"].includes(item.result));
  const wins = settled.filter((item) => item.result === "win").length;
  const losses = settled.filter((item) => item.result === "loss").length;
  const stake = settled.reduce((sum, item) => sum + Number(item.stake || 0), 0);
  const profit = settled.reduce((sum, item) => sum + Number(item.profit || 0), 0);
  const roi = stake > 0 ? profit / stake : average(settled.map((item) => item.roi));
  const hitRate = wins + losses > 0 ? wins / (wins + losses) : 0;
  const averageCLV = average(records.map((item) => item.clvPercent));
  const averageSharp = average(records.map((item) => item.sharpIndex));

  return {
    total: records.length,
    settled: settled.length,
    wins,
    losses,
    pushes: settled.filter((item) => item.result === "push").length,
    stake,
    profit,
    roi,
    hitRate,
    averageCLV,
    averageSharp,
    riskMode: classifyRiskMode({ roi, hitRate, averageCLV })
  };
}

function buildProfiles(records, key) {
  const grouped = new Map();
  for (const item of records) {
    const name = item[key] || "Unknown";
    const group = grouped.get(name) || [];
    group.push(item);
    grouped.set(name, group);
  }

  return Array.from(grouped.entries())
    .map(([name, group]) => {
      const settled = group.filter((item) => ["win", "loss", "push"].includes(item.result));
      const stake = settled.reduce((sum, item) => sum + Number(item.stake || 0), 0);
      const profit = settled.reduce((sum, item) => sum + Number(item.profit || 0), 0);
      const roi = stake > 0 ? profit / stake : average(settled.map((item) => item.roi));
      const wins = settled.filter((item) => item.result === "win").length;
      const losses = settled.filter((item) => item.result === "loss").length;
      const hitRate = wins + losses > 0 ? wins / (wins + losses) : 0;
      const averageCLV = average(group.map((item) => item.clvPercent));
      const averageSharp = average(group.map((item) => item.sharpIndex));
      const adjustment = clamp(roi * 18 + averageCLV * 0.8 + (averageSharp - 50) * 0.04 + (hitRate - 0.5) * 8, -8, 8);

      return {
        name,
        count: group.length,
        settled: settled.length,
        roi,
        hitRate,
        averageCLV,
        averageSharp,
        adjustment,
        grade: gradeProfile(adjustment)
      };
    })
    .sort((a, b) => b.adjustment - a.adjustment);
}

function buildWeights({ summary }) {
  return {
    edgeWeight: clamp(1 + summary.roi * 0.6, 0.75, 1.3),
    clvWeight: clamp(1 + summary.averageCLV / 20, 0.75, 1.35),
    sharpWeight: clamp(1 + (summary.averageSharp - 50) / 120, 0.75, 1.35),
    riskWeight: summary.riskMode === "defensive" ? 0.75 : summary.riskMode === "growth" ? 1.15 : 1,
    riskMode: summary.riskMode
  };
}

function buildRecommendations({ summary, leagueProfiles, marketProfiles }) {
  const notes = [];
  if (summary.riskMode === "defensive") notes.push("Model review suggests defensive paper exposure until results improve.");
  if (summary.averageCLV > 1) notes.push("Positive CLV profile supports current price selection process.");
  if (summary.averageCLV < -1) notes.push("Negative CLV profile suggests improving entry timing and price selection.");

  const topLeague = leagueProfiles[0];
  const weakLeague = [...leagueProfiles].reverse()[0];
  const topMarket = marketProfiles[0];

  if (topLeague?.adjustment > 2) notes.push(`${topLeague.name} has a strong historical profile.`);
  if (weakLeague?.adjustment < -2) notes.push(`${weakLeague.name} should be monitored due to weak profile.`);
  if (topMarket?.adjustment > 2) notes.push(`${topMarket.name} market has positive model profile.`);
  if (!notes.length) notes.push("Model learning is balanced. Keep collecting paper-trading data.");
  return notes;
}

function findProfileAdjustment(profiles, name) {
  if (!name) return 0;
  const profile = profiles.find((item) => item.name === name);
  if (!profile || profile.count < 3) return 0;
  return Number(profile.adjustment || 0);
}

function classifyRiskMode({ roi, hitRate, averageCLV }) {
  if (roi < -0.06 || hitRate < 0.42 || averageCLV < -2) return "defensive";
  if (roi > 0.06 && hitRate > 0.55 && averageCLV > 1) return "growth";
  return "balanced";
}

function gradeProfile(value) {
  if (value >= 5) return "A";
  if (value >= 2) return "B";
  if (value >= -2) return "C";
  if (value >= -5) return "D";
  return "F";
}

function gradeScore(score) {
  if (score >= 90) return "A+";
  if (score >= 84) return "A";
  if (score >= 72) return "B";
  if (score >= 62) return "C";
  if (score >= 50) return "D";
  return "F";
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
