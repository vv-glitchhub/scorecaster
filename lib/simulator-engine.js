function sampleOutcome(probabilities) {
  const r = Math.random();
  if (r < probabilities.home) return "home";
  if (r < probabilities.home + probabilities.draw) return "draw";
  return "away";
}

export function runMatchSimulation({
  iterations = 10000,
  probabilities,
  homeTeam,
  awayTeam,
}) {
  let home = 0;
  let draw = 0;
  let away = 0;

  for (let i = 0; i < iterations; i += 1) {
    const result = sampleOutcome(probabilities);
    if (result === "home") home += 1;
    if (result === "draw") draw += 1;
    if (result === "away") away += 1;
  }

  return {
    homeTeam,
    awayTeam,
    iterations,
    homeWinPct: Number(((home / iterations) * 100).toFixed(2)),
    drawPct: Number(((draw / iterations) * 100).toFixed(2)),
    awayWinPct: Number(((away / iterations) * 100).toFixed(2)),
  };
}
