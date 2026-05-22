export const MAJOR_BOOKMAKERS = [
  "Pinnacle",
  "Bet365",
  "Unibet",
  "Coolbet",
  "Nordic Bet",
  "NordicBet",
  "Betsson",
  "DraftKings",
  "FanDuel",
  "BetMGM",
  "Caesars",
  "William Hill",
  "Bovada",
  "Matchbook",
  "Tipico",
];

function isDraw(name) {
  const value = String(name || "").toLowerCase();
  return value === "draw" || value === "tie" || value === "tasapeli";
}

function isNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 1;
}

export function getBestMarketOdds(match) {
  const best = {
    home: { label: match?.home_team || "Home", odds: null, bookmaker: null },
    draw: { label: "Tasapeli", odds: null, bookmaker: null },
    away: { label: match?.away_team || "Away", odds: null, bookmaker: null },
  };

  for (const book of match?.bookmakers || []) {
    const bookmaker = book.title || book.key || "Bookmaker";

    for (const market of book.markets || []) {
      if (market.key !== "h2h") continue;

      for (const outcome of market.outcomes || []) {
        const price = Number(outcome.price);
        if (!isNumber(price)) continue;

        if (
          outcome.name === match.home_team &&
          (!best.home.odds || price > best.home.odds)
        ) {
          best.home = { label: match.home_team, odds: price, bookmaker };
        }

        if (
          outcome.name === match.away_team &&
          (!best.away.odds || price > best.away.odds)
        ) {
          best.away = { label: match.away_team, odds: price, bookmaker };
        }

        if (isDraw(outcome.name) && (!best.draw.odds || price > best.draw.odds)) {
          best.draw = { label: "Tasapeli", odds: price, bookmaker };
        }
      }
    }
  }

  return best;
}

export function getBestSinglePick(match) {
  const best = getBestMarketOdds(match);

  return [best.home, best.draw, best.away]
    .filter((item) => item?.odds)
    .sort((a, b) => b.odds - a.odds)[0];
}

export function getMajorBookmakerOdds(match) {
  const rows = [];

  for (const book of match?.bookmakers || []) {
    const bookmaker = book.title || book.key || "Bookmaker";

    const isMajor = MAJOR_BOOKMAKERS.some((name) =>
      bookmaker.toLowerCase().includes(name.toLowerCase())
    );

    if (!isMajor) continue;

    const row = {
      bookmaker,
      home: null,
      draw: null,
      away: null,
    };

    for (const market of book.markets || []) {
      if (market.key !== "h2h") continue;

      for (const outcome of market.outcomes || []) {
        const price = Number(outcome.price);
        if (!isNumber(price)) continue;

        if (outcome.name === match.home_team) row.home = price;
        if (outcome.name === match.away_team) row.away = price;
        if (isDraw(outcome.name)) row.draw = price;
      }
    }

    if (row.home || row.draw || row.away) {
      rows.push(row);
    }
  }

  return rows;
}
