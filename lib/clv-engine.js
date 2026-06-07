export function calculateCLV({ betOdds, closingOdds }) {
  const bet = Number(betOdds || 0);
  const close = Number(closingOdds || 0);

  if (!bet || !close || bet <= 1 || close <= 1) {
    return {
      clv: 0,
      clvPercent: 0,
      positive: false,
      grade: "N/A",
      note: "CLV not available."
    };
  }

  const betImplied = 1 / bet;
  const closingImplied = 1 / close;
  const clv = closingImplied - betImplied;
  const clvPercent = clv * 100;

  return {
    clv,
    clvPercent,
    positive: clv > 0,
    grade: gradeCLV(clvPercent),
    note: clv > 0 ? "Positive closing line value." : "Negative closing line value."
  };
}

export function calculateCLVV2({
  betOdds,
  currentOdds,
  closingOdds,
  stake = 0,
  market = "h2h",
  bookmaker = "unknown"
}) {
  const close = Number(closingOdds || currentOdds || 0);
  const base = calculateCLV({ betOdds, closingOdds: close });

  const stakeValue = Number(stake || 0);
  const expectedValueImpact = stakeValue * Number(base.clv || 0);
  const qualityScore = calculateCLVQualityScore(base.clvPercent, stakeValue);
  const learningSignal = buildCLVLearningSignal(base.clvPercent, qualityScore);

  return {
    ...base,
    version: "CLV_V2",
    betOdds: Number(betOdds || 0),
    currentOdds: Number(currentOdds || 0),
    closingOdds: close,
    market,
    bookmaker,
    stake: stakeValue,
    expectedValueImpact,
    qualityScore,
    learningSignal,
    recommendation: getCLVRecommendation(base.clvPercent)
  };
}

export function summarizeCLVHistory(bets = []) {
  const settled = bets.filter((bet) => bet.betOdds && (bet.closingOdds || bet.currentOdds));

  if (!settled.length) {
    return {
      count: 0,
      averageCLVPercent: 0,
      positiveRate: 0,
      totalExpectedValueImpact: 0,
      grade: "N/A",
      learningSignal: "neutral",
      note: "No CLV history yet."
    };
  }

  const results = settled.map((bet) =>
    calculateCLVV2({
      betOdds: bet.betOdds || bet.odds,
      currentOdds: bet.currentOdds,
      closingOdds: bet.closingOdds,
      stake: bet.stake,
      market: bet.market || bet.marketKey,
      bookmaker: bet.bookmaker
    })
  );

  const averageCLVPercent =
    results.reduce((sum, result) => sum + result.clvPercent, 0) / results.length;

  const positiveRate =
    results.filter((result) => result.positive).length / results.length;

  const totalExpectedValueImpact = results.reduce(
    (sum, result) => sum + result.expectedValueImpact,
    0
  );

  const averageQualityScore =
    results.reduce((sum, result) => sum + result.qualityScore, 0) / results.length;

  return {
    count: results.length,
    averageCLVPercent,
    positiveRate,
    totalExpectedValueImpact,
    averageQualityScore,
    grade: gradeCLV(averageCLVPercent),
    learningSignal: buildCLVLearningSignal(averageCLVPercent, averageQualityScore).signal,
    note: buildHistoryNote(averageCLVPercent, positiveRate),
    results
  };
}

export function buildCLVLearningSignal(clvPercent = 0, qualityScore = 0) {
  const clv = Number(clvPercent || 0);
  const quality = Number(qualityScore || 0);

  if (clv >= 3 && quality > 0.15) {
    return {
      signal: "increase_weight",
      strength: clamp(quality, 0, 1),
      note: "Strong positive CLV. Increase model confidence for similar setups."
    };
  }

  if (clv >= 0.75) {
    return {
      signal: "slight_increase_weight",
      strength: clamp(quality, 0, 0.5),
      note: "Positive CLV. Slightly increase confidence for similar setups."
    };
  }

  if (clv <= -3) {
    return {
      signal: "decrease_weight",
      strength: clamp(Math.abs(quality), 0, 1),
      note: "Strong negative CLV. Reduce model confidence for similar setups."
    };
  }

  if (clv <= -0.75) {
    return {
      signal: "slight_decrease_weight",
      strength: clamp(Math.abs(quality), 0, 0.5),
      note: "Negative CLV. Review timing and model assumptions."
    };
  }

  return {
    signal: "neutral",
    strength: 0,
    note: "Neutral CLV. No learning adjustment recommended yet."
  };
}

function calculateCLVQualityScore(clvPercent, stake) {
  const base = Number(clvPercent || 0) / 10;
  const stakeWeight = stake > 0 ? Math.min(stake / 100, 1) : 0.25;
  return clamp(base * stakeWeight, -1, 1);
}

function getCLVRecommendation(clvPercent) {
  if (clvPercent >= 5) return "Excellent entry. Market moved strongly in your favor.";
  if (clvPercent >= 2) return "Good entry. Market moved in your favor.";
  if (clvPercent >= 0.5) return "Small positive CLV. Entry was slightly better than close.";
  if (clvPercent > -0.5) return "Neutral CLV. Market did not move much.";
  if (clvPercent > -2) return "Slightly negative CLV. Review timing and price shopping.";
  return "Poor CLV. The market moved against your entry.";
}

function buildHistoryNote(averageCLVPercent, positiveRate) {
  if (averageCLVPercent > 2 && positiveRate > 0.55) {
    return "Strong CLV profile. Your process is beating the closing market.";
  }

  if (averageCLVPercent > 0 && positiveRate > 0.5) {
    return "Positive CLV profile. Keep tracking sample size.";
  }

  if (averageCLVPercent > -0.5) {
    return "Neutral CLV profile. More data is needed.";
  }

  return "Negative CLV profile. Improve line shopping and timing before increasing stake size.";
}

function gradeCLV(clvPercent) {
  if (clvPercent >= 5) return "A+";
  if (clvPercent >= 3) return "A";
  if (clvPercent >= 1.5) return "B";
  if (clvPercent >= 0) return "C";
  if (clvPercent >= -1.5) return "D";
  return "F";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
