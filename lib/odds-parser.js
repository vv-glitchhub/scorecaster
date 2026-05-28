export function parseOddsResponse(matches = [], selectedMarket = "h2h") {
  return matches
    .map((match) => {
      const bookmaker = match.bookmakers?.[0];
      if (!bookmaker) return null;

      const market =
        bookmaker.markets?.find((item) => item.key === selectedMarket) ||
        bookmaker.markets?.find((item) => item.key === "h2h") ||
        bookmaker.markets?.[0];

      if (!market) return null;

      const outcomes = market.outcomes || [];
      if (outcomes.length < 2) return null;

      return {
        id: match.id,
        sport: match.sport_title || match.sport_key || "Sport",
        commenceTime: match.commence_time,
        home: match.home_team || outcomes[0]?.name || "Unknown",
        away: match.away_team || outcomes[1]?.name || "Unknown",
        market: market.key || "market",
        bookmaker: bookmaker.title || bookmaker.key || "Bookmaker",
        outcomes: outcomes.map((outcome) => ({
          name: outcome.name,
          odds: Number(outcome.price),
          point: outcome.point ?? null
        }))
      };
    })
    .filter(Boolean);
}
