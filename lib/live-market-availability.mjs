// Availability is independent of recommendation quality.
export function marketCoverage(results = []) {
  const available = results.filter(result => result.ok);
  const unavailable = results.filter(result => !result.ok);
  return {
    requestedLeagueCount: results.length,
    availableLeagueCount: available.length,
    unavailableLeagues: unavailable.map(({ sportKey, errorCode }) => ({ sportKey, reason: errorCode || "unavailable" })),
    partialUpstream: unavailable.length > 0 || available.some(result => result.marketFallback),
    allUnavailable: results.length > 0 && available.length === 0
  };
}

export function directoryFixtures(games, sportKey, league) {
  const unique = new Map();
  for (const game of games) {
    if (!game.id || unique.has(game.id)) continue;
    unique.set(game.id, {
      id: String(game.id), homeTeam: game.home_team, awayTeam: game.away_team,
      commenceTime: game.commence_time, sportKey, league,
      bookmakerCount: Array.isArray(game.bookmakers) ? game.bookmakers.length : 0,
      fixtureVerifiedByProvider: true
    });
  }
  return [...unique.values()].sort((a, b) => Date.parse(a.commenceTime) - Date.parse(b.commenceTime));
}

export async function loadAvailableBatches(targets, load) {
  const results = await Promise.allSettled(targets.map(load));
  return results.map(result => result.status === "fulfilled" ? result.value : {
    ok: false, status: result.reason?.name === "TimeoutError" ? 504 : 502, payload: null, data: []
  });
}
