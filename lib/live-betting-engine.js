export function analyzeLiveBettingOpportunities({
  picks = [],
  bankroll = 1000,
  maxLiveExposure = 0.06,
  minLiveScore = 0.08
}) {
  const bank = Number(bankroll || 1000);
  const exposureLimit = bank * Number(maxLiveExposure || 0.06);

  const opportunities = picks
    .map((pick) => buildLiveOpportunity(pick, bank))
    .filter((item) => item.liveScore >= minLiveScore)
    .sort((a, b) => b.liveScore - a.liveScore);

  let usedExposure = 0;

  const allocated = opportunities.map((item, index) => {
    const stake = Math.min(
      item.suggestedLiveStake,
      Math.max(exposureLimit - usedExposure, 0)
    );

    usedExposure += stake;

    return {
      ...item,
      rank: index + 1,
      suggestedLiveStake: roundMoney(stake),
      exposurePercent: bank > 0 ? stake / bank : 0
    };
  }).filter((item) => item.suggestedLiveStake > 0);

  return {
    source: "live-betting-engine-v1",
    bankroll: bank,
    maxLiveExposure,
    exposureLimit: roundMoney(exposureLimit),
    allocatedExposure: roundMoney(allocated.reduce((sum, item) => sum + item.suggestedLiveStake, 0)),
    count: allocated.length,
    riskLevel: classifyLiveRisk(allocated, bank),
    opportunities: allocated
  };
}

function buildLiveOpportunity(pick, bankroll) {
  const finalScore = Number(pick.finalScore || 0);
  const edge = Number(pick.edge || 0);
  const sentiment = Number(pick.sentimentScore || 0);
  const trust = Number(pick.sourceTrust || 0.4);
  const odds = Number(pick.odds || 0);

  const momentumScore = calculateMomentumScore(pick);
  const readinessPenalty = pick.readiness?.level === "Low" ? -0.04 : 0;
  const riskPenalty = pick.riskLevel === "High" ? -0.03 : 0;

  const liveScore = clamp(
    finalScore + edge + sentiment + momentumScore + trust * 0.02 + readinessPenalty + riskPenalty,
    -1,
    1
  );

  const suggestedLiveStake = bankroll * clamp(liveScore * 0.12, 0, 0.025);

  return {
    selection: pick.selection,
    homeTeam: pick.homeTeam,
    awayTeam: pick.awayTeam,
    league: pick.league || pick.leagueTitle,
    bookmaker: pick.bookmaker,
    odds,
    decision: pick.decision,
    finalScore,
    edge,
    sentimentScore: sentiment,
    sourceTrust: trust,
    momentumScore,
    liveScore,
    trigger: buildTrigger(pick, momentumScore, liveScore),
    suggestedLiveStake: roundMoney(suggestedLiveStake)
  };
}

function calculateMomentumScore(pick) {
  const movement = String(pick.movementSignal || "Stable").toLowerCase();

  if (movement.includes("steam") || movement.includes("strong")) return 0.03;
  if (movement.includes("positive") || movement.includes("shortening")) return 0.02;
  if (movement.includes("drift") || movement.includes("negative")) return -0.02;
  return 0;
}

function buildTrigger(pick, momentumScore, liveScore) {
  if (pick.decision === "BET" && liveScore >= 0.16) {
    return "Strong live entry candidate if price remains available.";
  }

  if (momentumScore > 0) {
    return "Market movement supports a possible live entry.";
  }

  if (pick.decision === "WATCH") {
    return "Watch for odds improvement before entering.";
  }

  return "Only enter if price improves and risk stays controlled.";
}

function classifyLiveRisk(opportunities, bankroll) {
  const total = opportunities.reduce((sum, item) => sum + item.suggestedLiveStake, 0);
  const ratio = bankroll > 0 ? total / bankroll : 0;

  if (ratio >= 0.08) return "High";
  if (ratio >= 0.04) return "Medium";
  if (ratio > 0) return "Low";
  return "None";
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
