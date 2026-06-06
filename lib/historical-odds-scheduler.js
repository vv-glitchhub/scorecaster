import { buildHistoricalOddsSnapshot } from "./historical-odds-engine";

export function buildHistoricalOddsSnapshotsFromGames({
  games = [],
  marketKey = "h2h",
  timestamp = new Date().toISOString()
}) {
  const snapshots = [];

  for (const game of games || []) {
    const bookmakers = Array.isArray(game.bookmakers) ? game.bookmakers : [];

    for (const bookmaker of bookmakers) {
      const markets = Array.isArray(bookmaker.markets) ? bookmaker.markets : [];
      const market = markets.find((item) => item.key === marketKey);
      const outcomes = Array.isArray(market?.outcomes) ? market.outcomes : [];

      for (const outcome of outcomes) {
        snapshots.push(
          buildHistoricalOddsSnapshot({
            gameId: game.id,
            homeTeam: game.home_team || game.homeTeam,
            awayTeam: game.away_team || game.awayTeam,
            league: game.sport_key || game.sport_title,
            marketKey,
            bookmaker: bookmaker.title || bookmaker.key,
            selection: outcome.name,
            odds: outcome.price,
            timestamp
          })
        );
      }
    }
  }

  return snapshots;
}

export function mergeHistoricalOddsSnapshots({ existing = [], incoming = [], maxSnapshots = 5000 }) {
  const map = new Map();

  for (const item of [...existing, ...incoming]) {
    if (!item?.id) continue;
    map.set(item.id, item);
  }

  return [...map.values()]
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .slice(-maxSnapshots);
}

export function summarizeHistoricalOddsCollection(snapshots = []) {
  const leagues = new Set();
  const games = new Set();
  const bookmakers = new Set();

  for (const item of snapshots || []) {
    if (item.league) leagues.add(item.league);
    if (item.gameId) games.add(item.gameId);
    if (item.bookmaker) bookmakers.add(item.bookmaker);
  }

  const sorted = [...snapshots].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return {
    count: snapshots.length,
    leagues: leagues.size,
    games: games.size,
    bookmakers: bookmakers.size,
    firstSnapshotAt: sorted[0]?.timestamp || null,
    latestSnapshotAt: sorted[sorted.length - 1]?.timestamp || null
  };
}
