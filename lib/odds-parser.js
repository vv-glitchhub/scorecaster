import {
  getBestOddsBySelection,
  countBookmakersForMarket
} from "./bookmaker-engine";

export function parseOddsResponse(matches = [], selectedMarket = "h2h") {
  if (!Array.isArray(matches)) return [];

  return matches
    .map((match) => {
      const bestOdds = getBestOddsBySelection(match, selectedMarket);
      const bookmakerCount = countBookmakersForMarket(match, selectedMarket);

      if (bestOdds.length < 2) return null;

      const home = match.home_team || bestOdds[0]?.name || "Home";
      const away = match.away_team || bestOdds[1]?.name || "Away";

      return {
        id:
          match.id ||
          `${match.sport_key || "sport"}-${home}-${away}-${
            match.commence_time || ""
          }`,
        sport: match.sport_title || match.sport_key || "Sport",
        commenceTime: match.commence_time || null,
        home,
        away,
        market: selectedMarket,
        bookmaker: bestOdds[0]?.bookmaker || "Best odds",
        bookmakerCount,
        outcomes: bestOdds.map((outcome) => ({
          name: outcome.name || "Selection",
          odds: Number(outcome.odds),
          point: outcome.point ?? null,
          bookmaker: outcome.bookmaker,
          bookmakerKey: outcome.bookmakerKey,
          lastUpdate: outcome.lastUpdate
        }))
      };
    })
    .filter(Boolean);
}
