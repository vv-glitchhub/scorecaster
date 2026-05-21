function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function analyzeSteamMove(match = {}) {
  const history = Array.isArray(match.oddsHistory) ? match.oddsHistory : [];

  if (history.length < 2) {
    return {
      detected: false,
      type: "none",
      confidence: 0,
      message: "Ei tarpeeksi odds-historiaa steam move -analyysiin.",
    };
  }

  const first = history[0];
  const last = history[history.length - 1];

  const homeMove = num(first.homeOdds) - num(last.homeOdds);
  const awayMove = num(first.awayOdds) - num(last.awayOdds);

  const strongest =
    Math.abs(homeMove) >= Math.abs(awayMove)
      ? { side: match.home_team, move: homeMove }
      : { side: match.away_team, move: awayMove };

  const strength = Math.abs(strongest.move);
  const detected = strength >= 0.15;

  return {
    detected,
    type: detected ? "steam" : "normal",
    side: strongest.side,
    strength,
    confidence: Math.min(100, Math.round(strength * 220)),
    message: detected
      ? `Nopea markkinaliike kohteeseen ${strongest.side}. Mahdollinen steam move.`
      : "Ei merkittävää steam movea.",
  };
}
