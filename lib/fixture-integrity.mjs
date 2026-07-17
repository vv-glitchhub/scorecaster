const HOUR_MS = 60 * 60 * 1000;

function normalizedText(value) {
  return String(value || "").trim();
}

export function kickoffTimestamp(value) {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function isUsableLiveFixture(game, {
  now = Date.now(),
  pastGraceHours = 2,
  maxFutureHours = 24 * 45
} = {}) {
  if (!game || typeof game !== "object") return false;

  const id = normalizedText(game.id);
  const sportKey = normalizedText(game.sport_key);
  const homeTeam = normalizedText(game.home_team);
  const awayTeam = normalizedText(game.away_team);
  const kickoff = kickoffTimestamp(game.commence_time);
  const bookmakers = Array.isArray(game.bookmakers) ? game.bookmakers : [];

  if (!id || !sportKey || !homeTeam || !awayTeam) return false;
  if (homeTeam.toLowerCase() === awayTeam.toLowerCase()) return false;
  if (kickoff === null) return false;
  if (kickoff < now - pastGraceHours * HOUR_MS) return false;
  if (kickoff > now + maxFutureHours * HOUR_MS) return false;
  if (!bookmakers.length) return false;

  const hasUsableMarket = bookmakers.some((bookmaker) =>
    Array.isArray(bookmaker?.markets) && bookmaker.markets.some((market) =>
      Array.isArray(market?.outcomes) && market.outcomes.length >= 2
    )
  );

  return hasUsableMarket;
}

export function withinUpcomingWindow(value, hours, now = Date.now()) {
  const kickoff = kickoffTimestamp(value);
  if (kickoff === null || !Number.isFinite(Number(hours)) || Number(hours) <= 0) return false;
  return kickoff >= now - 15 * 60 * 1000 && kickoff <= now + Number(hours) * HOUR_MS;
}

export function filterUpcomingPicks(picks = [], hours, now = Date.now()) {
  return (Array.isArray(picks) ? picks : []).filter((pick) =>
    withinUpcomingWindow(pick?.commenceTime || pick?.commence_time, hours, now)
  );
}
