export function calculateMarketSignal({
  movementSignal = "Stable",
  bookmaker = "",
  clv = 0,
  polymarketDifference = 0
}) {
  let score = 0;
  const notes = [];

  if (movementSignal === "Steam Move Down") {
    score += 0.03;
    notes.push("Strong downward odds movement detected.");
  }

  if (movementSignal === "Odds Drift Up") {
    score -= 0.01;
    notes.push("Odds drifted upward. Market may be moving away.");
  }

  const sharpBooks = ["Pinnacle", "Matchbook", "Betfair"];
  if (sharpBooks.some((book) => bookmaker?.includes(book))) {
    score += 0.015;
    notes.push("Sharp bookmaker signal detected.");
  }

  if (Number(clv) > 0) {
    score += 0.02;
    notes.push("Positive CLV signal.");
  }

  if (Number(polymarketDifference) > 0.05) {
    score += 0.02;
    notes.push("Model is meaningfully above Polymarket probability.");
  }

  if (Number(polymarketDifference) < -0.05) {
    score -= 0.02;
    notes.push("Polymarket is below model view. Possible overconfidence risk.");
  }

  return {
    marketScore: Math.max(-0.1, Math.min(0.1, score)),
    notes: notes.length ? notes : ["No major market signal detected."]
  };
}
