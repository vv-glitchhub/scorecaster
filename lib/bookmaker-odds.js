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
  "Betfair",
];

function isDraw(name) {
  const value = String(name || "").toLowerCase();
  return value === "draw" || value === "tie" || value === "tasapeli";
}

function validOdds(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 1.01 && n < 100;
}

function impliedProbability(odds) {
  const n = Number(odds);
  if (!validOdds(n)) return 0;
  return 1 / n;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function estimateModelProbability({ odds, side, match }) {
  const implied = impliedProbability(odds);

  let boost = 0.018;

  const sportKey = String(match?.sport_key || "").toLowerCase();

  if (side === "draw") boost += 0.006;
  if (odds >= 3) boost += 0.018;
  if (odds >= 6) boost += 0.026;
  if (odds >= 10) boost += 0.034;
  if (sportKey.includes("soccer")) boost += 0.006;
  if (sportKey.includes("icehockey")) boost += 0.004;

  return clamp(implied + boost, 0.01, 0.72);
}

export function getBestMarketOdds(match) {
  const best = {
    home: { side: "home", label: match?.home_team || "Home", odds: null, bookmaker: null },
    draw: { side: "draw", label: "Tasapeli", odds: null, bookmaker: null },
    away: { side: "away", label: match?.away_team || "Away", odds: null, bookmaker: null },
  };

  for (const book of match?.bookmakers || []) {
    const bookmaker = book.title || book.key || "Bookmaker";

    for (const market of book.markets || []) {
      if (market.key !== "h2h") continue;

      for (const outcome of market.outcomes || []) {
        const price = Number(outcome.price);
        if (!validOdds(price)) continue;

        if (outcome.name === match.home_team && (!best.home.odds || price > best.home.odds)) {
          best.home = { side: "home", label: match.home_team, odds: price, bookmaker };
        }

        if (outcome.name === match.away_team && (!best.away.odds || price > best.away.odds)) {
          best.away = { side: "away", label: match.away_team, odds: price, bookmaker };
        }

        if (isDraw(outcome.name) && (!best.draw.odds || price > best.draw.odds)) {
          best.draw = { side: "draw", label: "Tasapeli", odds: price, bookmaker };
        }
      }
    }
  }

  return best;
}

export function getBestSinglePick(match) {
  const best = getBestMarketOdds(match);

  const candidates = [best.home, best.draw, best.away]
    .filter((item) => item?.odds)
    .map((item) => {
      const implied = impliedProbability(item.odds);
      const model = estimateModelProbability({
        odds: item.odds,
        side: item.side,
        match,
      });

      const edge = model - implied;
      const ev = item.odds * model - 1;

      return {
        id: `${match?.id}-${item.side}`,
        match,
        side: item.side,
        selection: item.label,
        odds: item.odds,
        bookmaker: item.bookmaker,
        impliedProbability: implied,
        modelProbability: model,
        edge,
        ev,
        confidence: clamp(55 + edge * 500, 50, 88),
        reason: buildReason({
          match,
          selection: item.label,
          odds: item.odds,
          bookmaker: item.bookmaker,
          implied,
          model,
          edge,
          ev,
        }),
      };
    });

  return candidates.sort((a, b) => b.edge - a.edge)[0] || null;
}

export function getTopValuePicks(matches = [], limit = 3) {
  return matches
    .map((match) => getBestSinglePick(match))
    .filter(Boolean)
    .sort((a, b) => {
      if (b.edge !== a.edge) return b.edge - a.edge;
      return b.odds - a.odds;
    })
    .slice(0, limit);
}

export function getParlaySummary(picks = []) {
  const totalOdds = picks.reduce((acc, pick) => acc * Number(pick.odds || 1), 1);
  const avgEdge =
    picks.length > 0
      ? picks.reduce((acc, pick) => acc + Number(pick.edge || 0), 0) / picks.length
      : 0;

  const avgConfidence =
    picks.length > 0
      ? picks.reduce((acc, pick) => acc + Number(pick.confidence || 0), 0) / picks.length
      : 0;

  return {
    totalOdds,
    avgEdge,
    avgConfidence,
  };
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
        if (!validOdds(price)) continue;

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

function buildReason({ match, selection, odds, bookmaker, implied, model, edge, ev }) {
  const impliedPct = percent(implied);
  const modelPct = percent(model);
  const edgePct = percent(edge);

  const sport = match?.sport_title || match?.sport_key || "ottelu";

  const parts = [];

  parts.push(
    `${selection} nousee value-kohteeksi, koska paras markkinahinta on ${odds} bookkerilla ${bookmaker}.`
  );

  parts.push(
    `Kertoimen implied probability on noin ${impliedPct}, mutta Scorecasterin kevyt malli arvioi todennäköisyydeksi noin ${modelPct}.`
  );

  parts.push(
    `Tästä syntyy noin ${edgePct} etu markkinaan nähden.`
  );

  if (ev > 0) {
    parts.push(
      `Odotusarvo on positiivinen, joten kohde kannattaa nostaa jatkotarkasteluun.`
    );
  }

  if (Number(odds) >= 6) {
    parts.push(
      `Kyseessä on korkean kertoimen kohde, joten osumaprosentti on luonnostaan matala ja panoksen pitää olla pieni.`
    );
  }

  if (String(sport).toLowerCase().includes("serie") || String(sport).toLowerCase().includes("soccer")) {
    parts.push(
      `Jalkapallossa tasapeli ja altavastaajan korkeat kertoimet voivat luoda valuea, jos markkina ylireagoi suosikkiin.`
    );
  }

  return parts;
}

export function percent(value) {
  const n = Number(value || 0);
  return `${(n * 100).toFixed(1)}%`;
}
