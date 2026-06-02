export function getAgentConfidenceBoost({ sportKey, marketKey, learning }) {
  let boost = 0;

  const sport = learning?.bySport?.[sportKey];
  const market = learning?.byMarket?.[marketKey];

  if (sport?.profit > 0) boost += 0.01;
  if (sport?.profit > 25) boost += 0.01;
  if (sport?.winRate >= 0.55 && sport?.bets >= 3) boost += 0.01;

  if (market?.profit > 0) boost += 0.01;
  if (market?.profit > 25) boost += 0.01;
  if (market?.winRate >= 0.55 && market?.bets >= 3) boost += 0.01;

  if (sport?.profit < 0) boost -= 0.01;
  if (market?.profit < 0) boost -= 0.01;

  return boost;
}

export function calculateAgentScore({ pick, learning }) {
  const confidenceBoost = getAgentConfidenceBoost({
    sportKey: pick.sportKey,
    marketKey: pick.marketKey,
    learning
  });

  const edge = Number(pick.edge || 0);
  const ev = Number(pick.ev || 0);

  return {
    agentScore: edge + ev * 0.25 + confidenceBoost,
    confidenceBoost
  };
}
