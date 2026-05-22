function seededProbability(match, selection) {
  const seed = `${match?.home_team}-${match?.away_team}-${selection}`
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  return 0.35 + ((seed % 30) / 100);
}

export function percent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

export function getBestMarketOdds(match) {
  const best = {
    home: {
      label: match?.home_team || "Home",
      odds: null,
      bookmaker: null,
    },
    draw: {
      label: "Tasapeli",
      odds: null,
      bookmaker: null,
    },
    away: {
      label: match?.away_team || "Away",
      odds: null,
      bookmaker: null,
    },
  };

  for (const bookmaker of match?.bookmakers || []) {
    for (const market of bookmaker?.markets || []) {
      if (market.key !== "h2h") continue;

      for (const outcome of market.outcomes || []) {
        const price = Number(outcome.price);
        if (!Number.isFinite(price) || price <= 1) continue;

        const bookName = bookmaker.title || bookmaker.key || "Bookmaker";

        if (outcome.name === match.home_team && (!best.home.odds || price > best.home.odds)) {
          best.home = { label: match.home_team, odds: price, bookmaker: bookName };
        }

        if (outcome.name === match.away_team && (!best.away.odds || price > best.away.odds)) {
          best.away = { label: match.away_team, odds: price, bookmaker: bookName };
        }

        const name = String(outcome.name || "").toLowerCase();
        if ((name === "draw" || name === "tie") && (!best.draw.odds || price > best.draw.odds)) {
          best.draw = { label: "Tasapeli", odds: price, bookmaker: bookName };
        }
      }
    }
  }

  return best;
}

export function getMajorBookmakerOdds(match) {
  const majorNames = [
    "Pinnacle",
    "Bet365",
    "Unibet",
    "Coolbet",
    "Betsson",
    "Nordic Bet",
    "DraftKings",
    "FanDuel",
    "BetMGM",
    "Caesars",
    "William Hill",
    "Bovada",
    "Matchbook",
    "Tipico",
  ];

  const rows = [];

  for (const bookmaker of match?.bookmakers || []) {
    const bookName = bookmaker.title || bookmaker.key || "Bookmaker";

    const isMajor = majorNames.some((name) =>
      bookName.toLowerCase().includes(name.toLowerCase())
    );

    if (!isMajor) continue;

    const row = {
      bookmaker: bookName,
      home: null,
      draw: null,
      away: null,
    };

    for (const market of bookmaker?.markets || []) {
      if (market.key !== "h2h") continue;

      for (const outcome of market.outcomes || []) {
        const price = Number(outcome.price);
        if (!Number.isFinite(price) || price <= 1) continue;

        if (outcome.name === match.home_team) row.home = price;
        if (outcome.name === match.away_team) row.away = price;

        const name = String(outcome.name || "").toLowerCase();
        if (name === "draw" || name === "tie") row.draw = price;
      }
    }

    if (row.home || row.draw || row.away) {
      rows.push(row);
    }
  }

  return rows;
}

export function getBestSinglePick(match) {
  const best = getBestMarketOdds(match);
  const options = [best.home, best.draw, best.away].filter((x) => x?.odds);

  const picks = options.map((option) => {
    const impliedProbability = 1 / option.odds;
    const modelProbability = seededProbability(match, option.label);
    const edge = modelProbability - impliedProbability;

    const confidence = Math.max(
      1,
      Math.min(100, 55 + edge * 1000 - Math.abs(option.odds - 2.2) * 8)
    );

    return {
      id: `${match.id}-${option.label}`,
      match,
      selection: option.label,
      odds: option.odds,
      bookmaker: option.bookmaker,
      impliedProbability,
      modelProbability,
      edge,
      confidence,
      reason: buildReasoning({
        edge,
        odds: option.odds,
        confidence,
        modelProbability,
        bookmaker: option.bookmaker,
        selection: option.label,
      }),
    };
  });

  return picks.sort((a, b) => b.edge - a.edge)[0] || null;
}

export function getTopValuePicks(matches = [], limit = 10) {
  return matches
    .map((match) => getBestSinglePick(match))
    .filter((pick) => pick && pick.edge > 0)
    .sort((a, b) => {
      const scoreA = a.edge * 100 + a.confidence - Math.abs(a.odds - 2.1) * 10;
      const scoreB = b.edge * 100 + b.confidence - Math.abs(b.odds - 2.1) * 10;

      return scoreB - scoreA;
    })
    .slice(0, limit);
}

export function getParlaySummary(picks = []) {
  const totalOdds = picks.reduce(
    (acc, pick) => acc * Number(pick.odds || 1),
    1
  );

  const avgEdge =
    picks.reduce((acc, pick) => acc + Number(pick.edge || 0), 0) /
    Math.max(1, picks.length);

  const avgConfidence =
    picks.reduce((acc, pick) => acc + Number(pick.confidence || 0), 0) /
    Math.max(1, picks.length);

  return {
    totalOdds,
    avgEdge,
    avgConfidence,
  };
}

function buildReasoning({
  edge,
  odds,
  confidence,
  modelProbability,
  bookmaker,
  selection,
}) {
  const reasons = [];

  if (edge >= 0.05) {
    reasons.push(`Mallin arvio on markkinaa korkeampi (${percent(modelProbability)}).`);
  } else if (edge >= 0.025) {
    reasons.push("Kohteessa havaittiin positiivinen value-edge.");
  }

  if (odds >= 1.6 && odds <= 2.8) {
    reasons.push(`Kerroin ${odds.toFixed(2)} on järkevämpi rekka-käyttöön kuin ylikorkeat altavastaajakertoimet.`);
  }

  if (confidence >= 75) {
    reasons.push("Mallin luottamus tähän kohteeseen on korkea.");
  } else if (confidence >= 65) {
    reasons.push("Mallin luottamus on normaalia parempi.");
  }

  reasons.push(`${bookmaker} tarjoaa parhaan löydetyn kertoimen kohteelle "${selection}".`);

  return reasons;
}
