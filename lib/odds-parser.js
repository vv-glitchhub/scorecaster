export function parseOddsResponse(matches = [], selectedMarket = "h2h") {
  if (!Array.isArray(matches)) return [];

  return matches
    .map((match) => {
      const bookmakers = Array.isArray(match.bookmakers)
        ? match.bookmakers
        : [];

      if (bookmakers.length === 0) return null;

      const bookmaker =
        bookmakers.find((book) =>
          book.markets?.some((market) => market.key === selectedMarket)
        ) || bookmakers[0];

      const markets = Array.isArray(bookmaker.markets)
        ? bookmaker.markets
        : [];

      const market =
        markets.find((item) => item.key === selectedMarket) ||
        markets.find((item) => item.key === "h2h") ||
        markets[0];

      if (!market) return null;

      const outcomes = Array.isArray(market.outcomes)
        ? market.outcomes
        : [];

      if (outcomes.length < 2) return null;

      const home =
        match.home_team ||
        outcomes[0]?.name ||
        "Home";

      const away =
        match.away_team ||
        outcomes[1]?.name ||
        "Away";

      return {
        id:
          match.id ||
          `${match.sport_key || "sport"}-${home}-${away}-${match.commence_time || ""}`,
        sport: match.sport_title || match.sport_key || "Sport",
        commenceTime: match.commence_time || null,
        home,
        away,
        market: market.key || selectedMarket,
        bookmaker: bookmaker.title || bookmaker.key || "Bookmaker",
        outcomes: outcomes
          .filter((outcome) => outcome?.price)
          .map((outcome) => ({
            name: outcome.name || "Selection",
            odds: Number(outcome.price),
            point: outcome.point ?? null
          }))
      };
    })
    .filter(Boolean);
}
