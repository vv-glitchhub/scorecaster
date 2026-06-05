const MAX_TOTAL_EXPOSURE = 0.2;
const MAX_SINGLE_BET = 0.04;
const MIN_EDGE_FOR_POSITION = 0.03;
const MIN_EV_FOR_POSITION = 0.01;

function isBetCandidate(pick) {
  if (pick.decision === "BET") return true;

  const edge = Number(pick.edge || 0);
  const ev = Number(pick.ev || 0);
  const score = Number(pick.finalScore || pick.agentScore || 0);

  return edge >= MIN_EDGE_FOR_POSITION && ev >= MIN_EV_FOR_POSITION && score >= 0.04;
}

export function calculateBankrollPlan({ bankroll = 1000, picks = [] }) {
  const candidates = picks.filter(isBetCandidate);
  const totalAllowed = bankroll * MAX_TOTAL_EXPOSURE;

  let allocated = 0;

  const recommendations = candidates.map((pick) => {
    const confidence = Number(pick.finalScore || pick.agentScore || pick.edge || 0);

    let stake =
      bankroll * Math.min(Math.max(confidence, 0.01) * 0.15, MAX_SINGLE_BET);

    allocated += stake;

    return {
      match: pick.match,
      selection: pick.selection,
      odds: pick.odds,
      bookmaker: pick.bookmaker,
      decision: pick.decision || "MODEL",
      edge: Number(pick.edge || 0),
      ev: Number(pick.ev || 0),
      finalScore: confidence,
      stake
    };
  });

  if (allocated > totalAllowed && allocated > 0) {
    const scale = totalAllowed / allocated;

    recommendations.forEach((item) => {
      item.stake *= scale;
    });

    allocated = totalAllowed;
  }

  return {
    bankroll,
    allocated,
    remaining: bankroll - allocated,
    exposurePercent: bankroll > 0 ? allocated / bankroll : 0,
    maxTotalExposure: bankroll * MAX_TOTAL_EXPOSURE,
    maxSingleBet: bankroll * MAX_SINGLE_BET,
    recommendations
  };
}
