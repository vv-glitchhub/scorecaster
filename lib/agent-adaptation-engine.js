export function calculateAdaptiveBoost({ sportKey, marketKey, bookmaker, memory }) {
  let boost = 0;
  const notes = [];

  const sport = memory?.sports?.[sportKey];
  const market = memory?.markets?.[marketKey];
  const book = memory?.bookmakers?.[bookmaker];

  if (sport?.bets >= 5) {
    if (sport.profit > 0) {
      boost += 0.015;
      notes.push(`Positive historical performance in ${sportKey}.`);
    }

    if (sport.profit < 0) {
      boost -= 0.015;
      notes.push(`Negative historical performance in ${sportKey}.`);
    }
  }

  if (market?.bets >= 5) {
    if (market.profit > 0) {
      boost += 0.015;
      notes.push(`Positive historical performance in ${marketKey}.`);
    }

    if (market.profit < 0) {
      boost -= 0.015;
      notes.push(`Negative historical performance in ${marketKey}.`);
    }
  }

  if (book?.bets >= 5) {
    if (book.profit > 0) {
      boost += 0.01;
      notes.push(`Bookmaker history has been positive.`);
    }

    if (book.profit < 0) {
      boost -= 0.01;
      notes.push(`Bookmaker history has been negative.`);
    }
  }

  return {
    adaptiveBoost: Math.max(-0.05, Math.min(0.05, boost)),
    notes: notes.length ? notes : ["Not enough memory for adaptive boost."]
  };
}
