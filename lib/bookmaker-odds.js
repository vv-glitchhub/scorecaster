export function getBestMarketOdds(match) {
  const best = {
    home: { label: match?.home_team || "Home", odds: null, bookmaker: null },
    draw: { label: "Tasapeli", odds: null, bookmaker: null },
    away: { label: match?.away_team || "Away", odds: null, bookmaker: null },
  };

  for (const book of match?.bookmakers || []) {
    const bookName = book.title || book.key || "Bookmaker";

    for (const market of book.markets || []) {
      if (market.key !== "h2h") continue;

      for (const outcome of market.outcomes || []) {
        const price = Number(outcome.price);
        if (!Number.isFinite(price)) continue;

        if (outcome.name === match.home_team && (!best.home.odds || price > best.home.odds)) {
          best.home = { label: match.home_team, odds: price, bookmaker: bookName };
        }

        if (outcome.name === match.away_team && (!best.away.odds || price > best.away.odds)) {
          best.away = { label: match.away_team, odds: price, bookmaker: bookName };
        }

        const n = String(outcome.name || "").toLowerCase();
        if ((n === "draw" || n === "tie") && (!best.draw.odds || price > best.draw.odds)) {
          best.draw = { label: "Tasapeli", odds: price, bookmaker: bookName };
        }
      }
    }
  }

  return best;
}

export function getBestSinglePick(match) {
  const best = getBestMarketOdds(match);

  return [best.home, best.draw, best.away]
    .filter((x) => x.odds)
    .sort((a, b) => b.odds - a.odds)[0];
}
