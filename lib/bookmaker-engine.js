export function getBestOddsBySelection(game, selectedMarket = "h2h") {
  const selections = {};
  const bookmakers = Array.isArray(game.bookmakers) ? game.bookmakers : [];

  bookmakers.forEach((bookmaker) => {
    const market = bookmaker.markets?.find(
      (item) => item.key === selectedMarket
    );

    if (!market) return;

    market.outcomes?.forEach((outcome) => {
      const name =
        outcome.point !== undefined
          ? `${outcome.name} ${outcome.point}`
          : outcome.name;

      const odds = Number(outcome.price);
      if (!odds || odds <= 1) return;

      if (!selections[name] || odds > selections[name].odds) {
        selections[name] = {
          name,
          odds,
          point: outcome.point ?? null,
          bookmaker: bookmaker.title || bookmaker.key,
          bookmakerKey: bookmaker.key,
          lastUpdate: market.last_update || bookmaker.last_update || null
        };
      }
    });
  });

  return Object.values(selections).sort((a, b) => b.odds - a.odds);
}

export function countBookmakersForMarket(game, selectedMarket = "h2h") {
  const bookmakers = Array.isArray(game.bookmakers) ? game.bookmakers : [];

  return bookmakers.filter((bookmaker) =>
    bookmaker.markets?.some((market) => market.key === selectedMarket)
  ).length;
}
