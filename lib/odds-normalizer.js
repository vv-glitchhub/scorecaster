function cleanName(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (["home", "away", "team a", "team b"].includes(text.toLowerCase())) return "";
  return text;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 1 ? n : null;
}

export function isRealMatch(match) {
  const home = cleanName(match?.home_team);
  const away = cleanName(match?.away_team);

  if (!home || !away) return false;
  if (home.toLowerCase() === away.toLowerCase()) return false;

  return true;
}

export function hasBettingOdds(match) {
  return Boolean(toNumber(match?.bestOdds?.home) && toNumber(match?.bestOdds?.away));
}

export function normalizeOddsApiEvent(event, leagueLabel = "") {
  const bestOdds = {
    home: null,
    draw: null,
    away: null,
    over: null,
    under: null,
    point: null,
    spreadHome: null,
    spreadAway: null,
    spreadPointHome: null,
    spreadPointAway: null,
  };

  for (const bookmaker of event.bookmakers || []) {
    for (const market of bookmaker.markets || []) {
      if (market.key === "h2h") {
        for (const outcome of market.outcomes || []) {
          const price = toNumber(outcome.price);
          if (!price) continue;

          if (outcome.name === event.home_team) bestOdds.home = Math.max(bestOdds.home || 0, price);
          else if (outcome.name === event.away_team) bestOdds.away = Math.max(bestOdds.away || 0, price);
          else if (String(outcome.name).toLowerCase() === "draw") bestOdds.draw = Math.max(bestOdds.draw || 0, price);
        }
      }

      if (market.key === "totals") {
        for (const outcome of market.outcomes || []) {
          const price = toNumber(outcome.price);
          if (!price) continue;

          bestOdds.point = outcome.point ?? bestOdds.point;
          if (String(outcome.name).toLowerCase() === "over") bestOdds.over = Math.max(bestOdds.over || 0, price);
          if (String(outcome.name).toLowerCase() === "under") bestOdds.under = Math.max(bestOdds.under || 0, price);
        }
      }

      if (market.key === "spreads") {
        for (const outcome of market.outcomes || []) {
          const price = toNumber(outcome.price);
          if (!price) continue;

          if (outcome.name === event.home_team) {
            bestOdds.spreadHome = Math.max(bestOdds.spreadHome || 0, price);
            bestOdds.spreadPointHome = outcome.point;
          }

          if (outcome.name === event.away_team) {
            bestOdds.spreadAway = Math.max(bestOdds.spreadAway || 0, price);
            bestOdds.spreadPointAway = outcome.point;
          }
        }
      }
    }
  }

  return {
    id: event.id,
    source: "the-odds-api",
    sport_key: event.sport_key,
    sport_title: leagueLabel || event.sport_title || event.sport_key,
    commence_time: event.commence_time,
    home_team: cleanName(event.home_team),
    away_team: cleanName(event.away_team),
    bestOdds,
  };
}

export function normalizeSportsGameOddsEvent(event, leagueLabel = "") {
  const home = cleanName(event?.teams?.home?.names?.long || event?.homeTeam || event?.home_team);
  const away = cleanName(event?.teams?.away?.names?.long || event?.awayTeam || event?.away_team);

  const odds = event?.odds || event?.bestOdds || {};

  return {
    id: event.eventID || event.id,
    source: "sportsgameodds",
    sport_key: event.sportID || event.sport_key,
    sport_title: leagueLabel || event.leagueID || event.sportID || "League",
    commence_time: event.startsAt || event.commence_time,
    home_team: home,
    away_team: away,
    bestOdds: {
      home: toNumber(odds.homeOdds) || toNumber(odds.home) || toNumber(odds.moneylineHome),
      draw: toNumber(odds.drawOdds) || toNumber(odds.draw),
      away: toNumber(odds.awayOdds) || toNumber(odds.away) || toNumber(odds.moneylineAway),
      over: toNumber(odds.over),
      under: toNumber(odds.under),
      point: odds.point ?? null,
      spreadHome: toNumber(odds.spreadHome),
      spreadAway: toNumber(odds.spreadAway),
      spreadPointHome: odds.spreadPointHome ?? null,
      spreadPointAway: odds.spreadPointAway ?? null,
    },
  };
}

export function uniqueMatches(matches = []) {
  const seen = new Set();
  const out = [];

  for (const match of matches) {
    if (!isRealMatch(match)) continue;

    const key = `${match.home_team.toLowerCase()}__${match.away_team.toLowerCase()}__${String(match.commence_time || "").slice(0, 10)}`;
    if (seen.has(key)) continue;

    seen.add(key);
    out.push(match);
  }

  return out;
}
