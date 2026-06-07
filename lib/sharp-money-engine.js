export function calculateSharpMoneySignal(pick = {}) {
  const lineMovement = calculateLineMovement(pick);
  const bookmakerDisagreement = calculateBookmakerDisagreement(pick);
  const closingLine = calculateClosingLineSignal(pick);
  const liquidity = calculateLiquiditySignal(pick);

  const score = clamp(
    lineMovement.score + bookmakerDisagreement.score + closingLine.score + liquidity.score,
    -0.08,
    0.08
  );

  return {
    score,
    label: labelSharpSignal(score),
    factors: {
      lineMovement,
      bookmakerDisagreement,
      closingLine,
      liquidity
    },
    notes: [
      lineMovement.note,
      bookmakerDisagreement.note,
      closingLine.note,
      liquidity.note
    ].filter(Boolean)
  };
}

function calculateLineMovement(pick) {
  const movement = Number(pick.lineMovement ?? pick.oddsMovement ?? 0);

  if (!movement) return { score: 0, note: "No sharp line movement detected." };
  if (movement >= 0.08) return { score: 0.03, note: "Strong positive steam move detected." };
  if (movement >= 0.04) return { score: 0.018, note: "Positive market movement supports the selection." };
  if (movement <= -0.08) return { score: -0.035, note: "Strong negative steam move against the selection." };
  if (movement <= -0.04) return { score: -0.02, note: "Market movement is against the selection." };
  return { score: 0, note: "Line movement is minor." };
}

function calculateBookmakerDisagreement(pick) {
  const bestOdds = Number(pick.bestOdds ?? pick.odds);
  const averageOdds = Number(pick.averageOdds ?? pick.marketAverageOdds);

  if (!Number.isFinite(bestOdds) || !Number.isFinite(averageOdds) || averageOdds <= 1) {
    return { score: 0, note: "Bookmaker disagreement data missing." };
  }

  const diff = (bestOdds - averageOdds) / averageOdds;
  if (diff >= 0.08) return { score: 0.018, note: "Best odds are meaningfully above market average." };
  if (diff >= 0.04) return { score: 0.01, note: "Best odds are slightly above market average." };
  if (diff <= -0.05) return { score: -0.015, note: "Available odds are below market average." };
  return { score: 0, note: "Bookmaker disagreement is neutral." };
}

function calculateClosingLineSignal(pick) {
  const openingOdds = Number(pick.openingOdds);
  const currentOdds = Number(pick.odds ?? pick.currentOdds);

  if (!Number.isFinite(openingOdds) || !Number.isFinite(currentOdds) || openingOdds <= 1 || currentOdds <= 1) {
    return { score: 0, note: "Opening/current odds data missing." };
  }

  const impliedOpen = 1 / openingOdds;
  const impliedCurrent = 1 / currentOdds;
  const probabilityMove = impliedCurrent - impliedOpen;

  if (probabilityMove >= 0.04) return { score: 0.02, note: "Closing-line direction supports the selection." };
  if (probabilityMove <= -0.04) return { score: -0.02, note: "Closing-line direction moved against the selection." };
  return { score: 0, note: "Closing-line movement is neutral." };
}

function calculateLiquiditySignal(pick) {
  const bookmakerCount = Number(pick.bookmakerCount ?? pick.bookmakers ?? 0);

  if (!bookmakerCount) return { score: 0, note: "Liquidity depth data missing." };
  if (bookmakerCount >= 8) return { score: 0.01, note: "Strong bookmaker depth improves price confidence." };
  if (bookmakerCount <= 2) return { score: -0.01, note: "Thin bookmaker depth lowers confidence." };
  return { score: 0, note: "Bookmaker depth is acceptable." };
}

function labelSharpSignal(score) {
  if (score >= 0.045) return "Bullish";
  if (score >= 0.015) return "Slightly Bullish";
  if (score <= -0.045) return "Bearish";
  if (score <= -0.015) return "Slightly Bearish";
  return "Neutral";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
