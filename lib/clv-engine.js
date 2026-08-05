// Legacy compatibility wrapper.
// Trusted CLV lives in calibration-lab-v1 and requires verified real closing evidence.

export function calculateCLV({ betOdds, closingOdds, closingEvidenceVerified = false }) {
  const bet = Number(betOdds || 0);
  const close = Number(closingOdds || 0);

  if (!closingEvidenceVerified || !bet || !close || bet <= 1 || close <= 1) {
    return {
      clv: null,
      clvPercent: null,
      positive: null,
      grade: "N/A",
      evidenceVerified: false,
      note: "Verified pre-start closing evidence is required. Current or simulated odds are not accepted."
    };
  }

  const clv = bet / close - 1;
  const clvPercent = clv * 100;
  return {
    clv,
    clvPercent,
    positive: clv > 0,
    grade: gradeCLV(clvPercent),
    evidenceVerified: true,
    note: clv > 0 ? "Entry price beat the verified closing price." : "Entry price did not beat the verified closing price."
  };
}

export function calculateCLVV2({
  betOdds,
  closingOdds,
  closingEvidenceVerified = false,
  stake = 0,
  market = "h2h",
  bookmaker = "unknown"
}) {
  const base = calculateCLV({ betOdds, closingOdds, closingEvidenceVerified });
  const stakeValue = Number(stake || 0);
  return {
    ...base,
    version: "CLV_V2_DEPRECATED_SAFE",
    betOdds: Number(betOdds || 0),
    currentOdds: null,
    closingOdds: base.evidenceVerified ? Number(closingOdds) : null,
    market,
    bookmaker,
    stake: stakeValue,
    expectedValueImpact: base.evidenceVerified ? stakeValue * Number(base.clv || 0) : null,
    qualityScore: null,
    learningSignal: {
      signal: "neutral",
      strength: 0,
      note: "Legacy CLV never changes model weights. Use Calibration Lab evidence for human review."
    },
    recommendation: base.evidenceVerified
      ? getCLVRecommendation(base.clvPercent)
      : "Wait for verified closing evidence from Calibration Lab.",
    automaticModelPromotion: false,
    currentOddsFallbackUsed: false,
    simulatedClosingUsed: false
  };
}

export function summarizeCLVHistory(bets = []) {
  const verified = (Array.isArray(bets) ? bets : []).filter((bet) =>
    bet?.closingEvidenceVerified === true && Number(bet.betOdds || bet.odds) > 1 && Number(bet.closingOdds) > 1
  );

  if (!verified.length) {
    return {
      count: 0,
      received: Array.isArray(bets) ? bets.length : 0,
      excluded: Array.isArray(bets) ? bets.length : 0,
      averageCLVPercent: null,
      positiveRate: null,
      totalExpectedValueImpact: null,
      grade: "N/A",
      learningSignal: "neutral",
      evidenceReady: false,
      automaticModelPromotion: false,
      note: "No verified closing-line history. Simulated and current-price fallbacks are disabled."
    };
  }

  const results = verified.map((bet) => calculateCLVV2({
    betOdds: bet.betOdds || bet.odds,
    closingOdds: bet.closingOdds,
    closingEvidenceVerified: true,
    stake: bet.stake,
    market: bet.market || bet.marketKey,
    bookmaker: bet.bookmaker
  }));
  const averageCLVPercent = results.reduce((total, result) => total + result.clvPercent, 0) / results.length;
  const positiveRate = results.filter((result) => result.positive).length / results.length;
  const totalExpectedValueImpact = results.reduce((total, result) => total + Number(result.expectedValueImpact || 0), 0);

  return {
    count: results.length,
    received: Array.isArray(bets) ? bets.length : 0,
    excluded: (Array.isArray(bets) ? bets.length : 0) - results.length,
    averageCLVPercent,
    positiveRate,
    totalExpectedValueImpact,
    averageQualityScore: null,
    grade: gradeCLV(averageCLVPercent),
    learningSignal: "neutral",
    evidenceReady: results.length >= 100,
    automaticModelPromotion: false,
    note: "Verified CLV is informational. Automatic model-weight changes are disabled.",
    results
  };
}

export function buildCLVLearningSignal() {
  return {
    signal: "neutral",
    strength: 0,
    note: "CLV evidence supports human review only. Automatic model-weight changes are disabled."
  };
}

function getCLVRecommendation(clvPercent) {
  if (clvPercent >= 5) return "Strong positive verified CLV; continue collecting a larger sample.";
  if (clvPercent >= 1) return "Positive verified CLV; keep monitoring sample stability.";
  if (clvPercent > -1) return "Broadly neutral verified CLV.";
  return "Negative verified CLV; review timing and price selection without automatically changing the model.";
}

function gradeCLV(clvPercent) {
  if (!Number.isFinite(Number(clvPercent))) return "N/A";
  if (clvPercent >= 5) return "A+";
  if (clvPercent >= 3) return "A";
  if (clvPercent >= 1.5) return "B";
  if (clvPercent >= 0) return "C";
  if (clvPercent >= -1.5) return "D";
  return "F";
}
