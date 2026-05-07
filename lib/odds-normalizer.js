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

function emptyBestOdds() {
  return {
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
    books: {
      home: null,
      draw: null,
      away: null,
      over: null,
      under: null,
      spreadHome: null,
      spreadAway: null,
    },
    bookPrices: {
      home: [],
      draw: [],
      away: [],
      over: [],
      under: [],
      spreadHome: [],
      spreadAway: [],
    },
  };
}

function pushBookPrice(bestOdds, key, price, bookmaker) {
  const n = toNumber(price);
  if (!n) return;

  if (!bestOdds.bookPrices) bestOdds.bookPrices = {};
  if (!bestOdds.bookPrices[key]) bestOdds.bookPrices[key] = [];

  bestOdds.bookPrices[key].push({
    bookmaker: bookmaker || "Unknown",
    odds: n,
  });

  if (!bestOdds[key] || n > bestOdds[key]) {
    bestOdds[key] = n;
    if (!bestOdds.books) bestOdds.books = {};
    bestOdds.books[key] = bookmaker || "Unknown";
  }
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
  const bestOdds = emptyBestOdds();

  for (const bookmaker of event.bookmakers || []) {
    const bookName = bookmaker.title || bookmaker.key || "Unknown";

    for (const market of bookmaker.markets || []) {
      if (market.key === "h2h") {
        for (const outcome of market.outcomes || []) {
          if (outcome.name === event.home_team) {
            pushBookPrice(bestOdds, "home", outcome.price, bookName);
          } else if (outcome.name === event.away_team) {
            pushBookPrice(bestOdds, "away", outcome.price, bookName);
          } else if (String(outcome.name).toLowerCase() === "draw") {
            pushBookPrice(bestOdds, "draw", outcome.price, bookName);
          }
        }
      }

      if (market.key === "totals") {
        for (const outcome of market.outcomes || []) {
          bestOdds.point = outcome.point ?? bestOdds.point;

          if (String(outcome.name).toLowerCase() === "over") {
            pushBookPrice(bestOdds, "over", outcome.price, bookName);
          }

          if (String(outcome.name).toLowerCase() === "under") {
            pushBookPrice(bestOdds, "under", outcome.price, bookName);
          }
        }
      }

      if (market.key === "spreads") {
        for (const outcome of market.outcomes || []) {
          if (outcome.name === event.home_team) {
            bestOdds.spreadPointHome = outcome.point;
            pushBookPrice(bestOdds, "spreadHome", outcome.price, bookName);
          }

          if (outcome.name === event.away_team) {
            bestOdds.spreadPointAway = outcome.point;
            pushBookPrice(bestOdds, "spreadAway", outcome.price, bookName);
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

export function uniqueMatches(matches = []) {
  const seen = new Set();
  const out = [];

  for (const match of matches) {
    if (!isRealMatch(match)) continue;

    const key = `${match.home_team.toLowerCase()}__${match.away_team.toLowerCase()}__${String(
      match.commence_time || ""
    ).slice(0, 10)}`;

    if (seen.has(key)) continue;

    seen.add(key);
    out.push(match);
  }

  return out;
}
