export function getAgentConfidenceBoost({
  sportKey,
  marketKey,
  learning
}) {
  let boost = 0;

  const sport = learning?.bySport?.[sportKey];
  const market = learning?.byMarket?.[marketKey];

  if (sport?.roi > 0) boost += 0.02;
  if (sport?.roi > 50) boost += 0.02;

  if (market?.roi > 0) boost += 0.02;
  if (market?.roi > 50) boost += 0.02;

  return boost;
}
