function safe(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function detectSharpMoney(match = {}) {
  const history = Array.isArray(match.oddsHistory)
    ? match.oddsHistory
    : [];

  if (history.length < 2) {
    return {
      detected: false,
      direction: null,
      strength: 0,
      reason: "Not enough market history",
    };
  }

  const first = history[0];
  const latest = history[history.length - 1];

  const homeMove =
    safe(first.homeOdds) - safe(latest.homeOdds);

  const awayMove =
    safe(first.awayOdds) - safe(latest.awayOdds);

  const strongest =
    Math.abs(homeMove) > Math.abs(awayMove)
      ? {
          side: "home",
          value: homeMove,
        }
      : {
          side: "away",
          value: awayMove,
        };

  const detected = Math.abs(strongest.value) >= 0.15;

  return {
    detected,
    direction: detected
      ? strongest.side === "home"
        ? match.home_team
        : match.away_team
      : null,
    strength: Math.abs(strongest.value),
    reason: detected
      ? "Rapid odds movement detected across market."
      : "No significant sharp movement.",
  };
}
