export function calculateAdaptiveBoost({
  sport,
  market,
  memory
}) {
  let boost = 0;

  const sportData =
    memory?.sports?.[sport];

  const marketData =
    memory?.markets?.[market];

  if (
    sportData &&
    sportData.bets >= 20
  ) {
    if (sportData.profit > 0)
      boost += 0.02;

    if (sportData.profit < 0)
      boost -= 0.02;
  }

  if (
    marketData &&
    marketData.bets >= 20
  ) {
    if (marketData.profit > 0)
      boost += 0.02;

    if (marketData.profit < 0)
      boost -= 0.02;
  }

  return boost;
}
