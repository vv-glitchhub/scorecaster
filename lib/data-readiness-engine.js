export function checkDataReadiness({
  hasOdds = false,
  hasBestBookmaker = false,
  hasLineMovement = false,
  hasPolymarket = false,
  hasNews = false,
  hasInjuries = false,
  hasLineups = false,
  hasSourceTrust = false
}) {
  const checks = [
    { key: "Odds", ready: hasOdds, weight: 0.2 },
    { key: "Best bookmaker", ready: hasBestBookmaker, weight: 0.15 },
    { key: "Line movement", ready: hasLineMovement, weight: 0.15 },
    { key: "Polymarket", ready: hasPolymarket, weight: 0.1 },
    { key: "News", ready: hasNews, weight: 0.1 },
    { key: "Injuries", ready: hasInjuries, weight: 0.1 },
    { key: "Lineups", ready: hasLineups, weight: 0.1 },
    { key: "Source trust", ready: hasSourceTrust, weight: 0.1 }
  ];

  const score = checks.reduce(
    (sum, check) => sum + (check.ready ? check.weight : 0),
    0
  );

  const missing = checks.filter((check) => !check.ready).map((check) => check.key);

  let level = "Low";

  if (score >= 0.8) level = "High";
  else if (score >= 0.55) level = "Medium";

  return {
    score,
    level,
    missing,
    checks
  };
}

export function getReadinessRecommendation(readiness) {
  if (readiness.level === "High") {
    return "Data quality is good enough for a confident agent decision.";
  }

  if (readiness.level === "Medium") {
    return "Decision can be monitored, but some important data is still missing.";
  }

  return "Do not trust this pick yet. Too much data is missing.";
}
