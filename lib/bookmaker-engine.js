export function getBestOddsBySelection(match, selectedMarket = "h2h") {
  const selections = {};

  const bookmakers = Array.isArray(match.bookmakers) ? match.bookmakers : [];

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

      const price = Number(outcome.price);

      if (!selections[name] || price > selections[name].odds) {
        selections[name] = {
          name,
          odds: price,
          bookmaker: bookmaker.title || bookmaker.key,
          point: outcome.point ?? null
        };
      }
    });
  });

  return Object.values(selections).sort((a, b) => b.odds - a.odds);
}
