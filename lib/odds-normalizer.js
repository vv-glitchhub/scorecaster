function n(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function cleanTeamName(value) {
  return String(value || "")
    .replace("MontrÃ©al", "Montréal")
    .trim();
}

function isSaneTotalPoint(point, sportKey) {
  const p = n(point);

  if (sportKey?.includes("soccer")) return p >= 0.5 && p <= 5.5;
  if (sportKey?.includes("icehockey")) return p >= 4.5 && p <= 7.5;
  if (sportKey?.includes("basketball")) return p >= 120 && p <= 280;
  if (sportKey?.includes("americanfootball")) return p >= 25 && p <= 65;

  return p > 0;
}

function isSaneOdds(price) {
  const p = n(price);
  return p > 1.01 && p < 20;
}

function addPrice(bestOdds, key, bookmaker, odds, extra = {}) {
  if (!isSaneOdds(odds)) return;

  bestOdds.bookPrices[key] ||= [];
  bestOdds.bookPrices[key].push({
    bookmaker,
    odds: n(odds),
    ...extra,
  });

  if (!bestOdds[key] || n(odds) > n(bestOdds[key])) {
    bestOdds[key] = n(odds);
    bestOdds.books[key] = bookmaker;
  }
}

export function normalizeOddsApiEvent(event = {}) {
  const home = cleanTeamName(event.home_team);
  const away = cleanTeamName(event.away_team);

  const bestOdds = {
    books: {},
    bookPrices: {},
  };

  for (const bookmaker of event.bookmakers || []) {
    const book = bookmaker.title || bookmaker.key || "Unknown";

    for (const market of bookmaker.markets || []) {
      for (const outcome of market.outcomes || []) {
        const name = String(outcome.name || "").toLowerCase();
        const price = n(outcome.price);

        if (!isSaneOdds(price)) continue;

        if (market.key === "h2h") {
          if (name === home.toLowerCase()) {
            addPrice(bestOdds, "home", book, price);
          } else if (name === away.toLowerCase()) {
            addPrice(bestOdds, "away", book, price);
          } else if (name === "draw" || name === "tie") {
            addPrice(bestOdds, "draw", book, price);
          }
        }

        if (market.key === "totals") {
          if (!isSaneTotalPoint(outcome.point, event.sport_key)) continue;

          const key = name === "over" ? "over" : "under";

          bestOdds.point = outcome.point ?? bestOdds.point;

          addPrice(bestOdds, key, book, price, {
            point: outcome.point,
          });
        }

        if (market.key === "spreads") {
          if (name === home.toLowerCase()) {
            bestOdds.spreadPointHome = outcome.point;
            addPrice(bestOdds, "spreadHome", book, price, {
              point: outcome.point,
            });
          }

          if (name === away.toLowerCase()) {
            bestOdds.spreadPointAway = outcome.point;
            addPrice(bestOdds, "spreadAway", book, price, {
              point: outcome.point,
            });
          }
        }
      }
    }
  }

  return {
    id: event.id,
    source: "the-odds-api",
    sport_key: event.sport_key,
    sport_title: event.sport_title,
    commence_time: event.commence_time,
    home_team: home,
    away_team: away,
    event_type: "matchup",
    bookmakers: event.bookmakers || [],
    bestOdds,
  };
}

export function hasBettableOdds(match) {
  return Boolean(
    match?.bestOdds?.home ||
      match?.bestOdds?.away ||
      match?.bestOdds?.over ||
      match?.bestOdds?.under ||
      match?.bestOdds?.spreadHome ||
      match?.bestOdds?.spreadAway
  );
}
