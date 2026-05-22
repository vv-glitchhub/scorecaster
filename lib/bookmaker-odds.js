export const MAJOR_BOOKMAKERS = [
  "Pinnacle",
  "Bet365",
  "Unibet",
  "Coolbet",
  "Nordic Bet",
  "Betsson",
  "DraftKings",
  "FanDuel",
  "BetMGM",
  "Caesars",
  "William Hill",
  "Bovada",
];

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isDrawName(name) {
  const value = String(name || "").toLowerCase();
  return value === "draw" || value === "tie" || value === "tasapeli";
}

export function getBestMarketOdds(match) {
  const best = {
    home: { label: match?.home_team || "Home", odds: null, bookmaker: null },
    draw: { label: "Tasapeli", odds: null, bookmaker: null },
    away: { label: match?.away_team || "Away", odds: null, bookmaker: null },
  };

  for (const book of match?.bookmakers || []) {
    const bookName = book.title || book.key || "Bookmaker";

    for (const market of book.markets || []) {
      if (market.key !== "h2h") continue;

      for (const outcome of market.outcomes || []) {
        const price = num(outcome.price);
        if (!price) continue;

        if (outcome.name === match.home_team && (!best.home.odds || price > best.home.odds)) {
          best.home = { label: match.home_team, odds: price, bookmaker: bookName };
        }

        if (outcome.name === match.away_team && (!best.away.odds || price > best.away.odds)) {
          best.away = { label: match.away_team, odds: price, bookmaker: bookName };
        }

        if (isDrawName(outcome.name) && (!best.draw.odds || price > best.draw.odds)) {
          best.draw = { label: "Tasapeli", odds: price, bookmaker: bookName };
        }
      }
    }
  }

  return best;
}

export function getMajorBookmakerOdds(match) {
  const rows = [];

  for (const book of match?.bookmakers || []) {
    const bookName = book.title || book.key || "Bookmaker";
    const isMajor = MAJOR_BOOKMAKERS.some((name) =>
      bookName.toLowerCase().includes(name.toLowerCase())
    );

    if (!isMajor) continue;

    const row = {
      bookmaker: bookName,
      home: null,
      draw: null,
      away: null,
    };

    for (const market of book.markets || []) {
      if (market.key !== "h2h") continue;

      for (const outcome of market.outcomes || []) {
        const price = num(outcome.price);

        if (outcome.name === match.home_team) row.home = price;
        if (outcome.name === match.away_team) row.away = price;
        if (isDrawName(outcome.name)) row.draw = price;
      }
    }

    if (row.home || row.draw || row.away) rows.push(row);
  }

  return rows;
}
