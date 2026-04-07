export function calculateImpliedProbability(odds) {
  return odds > 0 ? 1 / odds : 0;
}

export function calculateEdge(modelProb, marketProb) {
  return modelProb - marketProb;
}

export function calculateEV(prob, odds) {
  return prob * odds - 1;
}

export function calculateKelly(prob, odds) {
  const b = odds - 1;

  if (b <= 0) return 0;

  const q = 1 - prob;
  const kelly = (b * prob - q) / b;

  return Math.max(0, kelly);
}

export function getRecommendationLevel(edge) {
  if (edge <= 0) return "no_bet";
  if (edge < 0.02) return "lean";
  if (edge < 0.05) return "playable";
  return "strong";
}

export function buildValueBets({
  oddsRows = [],
  modelProbabilities = {},
  bankroll = 1000,
}) {
  const results = [];

  for (const row of oddsRows) {
    const marketProb = calculateImpliedProbability(row.odds);

    const modelProb = modelProbabilities[row.outcome_name] ?? marketProb;

    const edge = calculateEdge(modelProb, marketProb);
    const ev = calculateEV(modelProb, row.odds);
    const kelly = calculateKelly(modelProb, row.odds);
    const stake = bankroll * kelly * 0.25;

    results.push({
      outcome: row.outcome_name,
      odds: row.odds,
      bookmaker: row.bookmaker,
      market: row.market,
      modelProb,
      marketProb,
      edge,
      ev,
      kelly,
      stake,
      level: getRecommendationLevel(edge),
    });
  }

  return results.sort((a, b) => b.edge - a.edge);
}
