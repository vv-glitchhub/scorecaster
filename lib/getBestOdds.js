export function getBestOddsFromBookmakers(bookmakers, marketKey = "h2h") {
  let best = {
    home: null,
    draw: null,
    away: null,
    bookmakerHome: null,
    bookmakerDraw: null,
    bookmakerAway: null,
  };

  for (const bookmaker of bookmakers || []) {
    const market = bookmaker.markets?.find(m => m.key === marketKey);
    if (!market) continue;

    for (const outcome of market.outcomes || []) {
      const name = outcome.name?.toLowerCase();
      const price = Number(outcome.price);

      if (!price) continue;

      if (name === "home" || name === "kotivoitto") {
        if (!best.home || price > best.home) {
          best.home = price;
          best.bookmakerHome = bookmaker.title;
        }
      } else if (name === "away" || name === "vierasvoitto") {
        if (!best.away || price > best.away) {
          best.away = price;
          best.bookmakerAway = bookmaker.title;
        }
      } else if (name === "draw" || name === "tasapeli") {
        if (!best.draw || price > best.draw) {
          best.draw = price;
          best.bookmakerDraw = bookmaker.title;
        }
      }
    }
  }

  return best;
}
