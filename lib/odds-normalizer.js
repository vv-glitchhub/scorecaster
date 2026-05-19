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
    books: {},
    bookPrices: {},
  };
}

function pushBookPrice(bestOdds, key, price, bookmaker) {
  const n = toNumber(price);
  if (!n) return;

  if (!bestOdds.bookPrices[key]) bestOdds.bookPrices[key] = [];

  bestOdds.bookPrices[key].push({
    bookmaker: bookmaker || "Unknown",
    odds: n,
  });

  if (!bestOdds[key] || n > bestOdds[key]) {
    bestOdds[key] = n;
    bestOdds.books[key] = bookmaker || "Unknown";
  }
}

function isGolfSport(event) {
  return String(event?.sport_key || "").startsWith("golf_");
}

function getCompetitors(event) {
  const home = cleanName(event?.home_team);
  const away = cleanName(event?.away_team);

  if (home && away) {
    return { home, away, type: "matchup" };
  }

  const outcomes =
    event?.bookmakers?.[0]?.markets?.[0]?.outcomes || [];

  const names = outcomes.map((o) => cleanName(o.name)).filter(Boolean);

  if (names.length >= 2) {
    return {
      home: names[0],
      away: names[1],
      type: isGolfSport(event) ? "outright" : "matchup",
    };
  }

  return {
    home: home || names[0] || "Unknown",
    away: away || "",
    type: isGolfSport(event) ? "outright" : "matchup",
  };
}

export function isRealMatch(match) {
  const home = cleanName(match?.home_team);
  const away = cleanName(match?.away_team);

  if (!home) return false;
  if (match?.event_type === "outright") return true;
  if (!away) return false;
  if (home.toLowerCase() === away.toLowerCase()) return false;

  return true;
}

export function hasBettingOdds(match) {
  if (match?.event_type === "outright") {
    return Boolean(match?.outrights?.length);
  }

  return Boolean(toNumber(match?.bestOdds?.home) && toNumber(match?.bestOdds?.away));
}

export function normalizeOddsApiEvent(event, leagueLabel = "") {
  const bestOdds = emptyBestOdds();
  const competitors = getCompetitors(event);
  const outrights = [];

  for (const bookmaker of event.bookmakers || []) {
    const bookName = bookmaker.title || bookmaker.key || "Unknown";

    for (const market of bookmaker.markets || []) {
      if (market.key === "h2h") {
        for (const outcome of market.outcomes || []) {
          const name = cleanName(outcome.name);

          if (competitors.type === "outright") {
            const price = toNumber(outcome.price);
            if (price) {
              outrights.push({
                label: name,
                odds: price,
                bookmaker: bookName,
              });
            }
            continue;
          }

          if (name === competitors.home) {
            pushBookPrice(bestOdds, "home", outcome.price, bookName);
          } else if (name === competitors.away) {
            pushBookPrice(bestOdds, "away", outcome.price, bookName);
          } else if (name.toLowerCase() === "draw") {
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
          const name = cleanName(outcome.name);

          if (name === competitors.home) {
            bestOdds.spreadPointHome = outcome.point;
            pushBookPrice(bestOdds, "spreadHome", outcome.price, bookName);
          }

          if (name === competitors.away) {
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
    home_team: competitors.home,
    away_team: competitors.away,
    event_type: competitors.type,
    bestOdds,
    outrights: outrights
      .sort((a, b) => Number(a.odds) - Number(b.odds))
      .slice(0, 20),
  };
}

export function uniqueMatches(matches = []) {
  const seen = new Set();
  const out = [];

  for (const match of matches) {
    if (!isRealMatch(match)) continue;

    const key = `${match.sport_key}__${match.home_team}__${match.away_team}__${String(
      match.commence_time || ""
    ).slice(0, 10)}`;

    if (seen.has(key)) continue;
    seen.add(key);
    out.push(match);
  }

  return out;
}
