export function getBestOddsByTeams(bookmakers, homeTeam, awayTeam) {
  let best = {
    home: null,
    draw: null,
    away: null,
    bookmakerHome: null,
    bookmakerDraw: null,
    bookmakerAway: null,
  };

  for (const bookmaker of bookmakers || []) {
    const market = bookmaker.markets?.find(m => m.key === "h2h");
    if (!market) continue;

    for (const outcome of market.outcomes || []) {
      const price = Number(outcome.price);
      if (!price) continue;

      if (outcome.name === homeTeam) {
        if (!best.home || price > best.home) {
          best.home = price;
          best.bookmakerHome = bookmaker.title;
        }
      } else if (outcome.name === awayTeam) {
        if (!best.away || price > best.away) {
          best.away = price;
          best.bookmakerAway = bookmaker.title;
        }
      } else if (outcome.name?.toLowerCase() === "draw") {
        if (!best.draw || price > best.draw) {
          best.draw = price;
          best.bookmakerDraw = bookmaker.title;
        }
      }
    }
  }

  return best;
}
