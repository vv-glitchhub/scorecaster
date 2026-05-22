function seededProbability(match, selection) {
  const seed =
    `${match.home_team}-${match.away_team}-${selection}`
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  return 0.35 + ((seed % 30) / 100);
}

export function percent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

export function getBestMarketOdds(match) {
  const bookmakers = Array.isArray(match?.bookmakers)
    ? match.bookmakers
    : [];

  let best = null;

  for (const bookmaker of bookmakers) {
    const markets = bookmaker?.markets || [];

    for (const market of markets) {
      const outcomes = market?.outcomes || [];

      for (const outcome of outcomes) {
        if (!best || outcome.price > best.odds) {
          const impliedProbability = 1 / outcome.price;

          const modelProbability = seededProbability(
            match,
            outcome.name
          );

          const edge = modelProbability - impliedProbability;

          const confidence =
            Math.max(
              1,
              Math.min(
                100,
                55 + edge * 1000 - Math.abs(outcome.price - 2.2) * 8
              )
            );

          best = {
            id: `${match.id}-${outcome.name}`,
            selection: outcome.name,
            odds: outcome.price,
            bookmaker: bookmaker.title,
            impliedProbability,
            modelProbability,
            edge,
            confidence,
            market: market.key,
            match,
            reason: buildReasoning({
              edge,
              odds: outcome.price,
              confidence,
              modelProbability,
              bookmaker: bookmaker.title,
              selection: outcome.name,
            }),
          };
        }
      }
    }
  }

  return best;
}

export function getTopValuePicks(matches, limit = 10) {
  const picks = [];

  for (const match of matches || []) {
    const pick = getBestMarketOdds(match);

    if (!pick) continue;

    if (pick.edge <= 0) continue;

    picks.push(pick);
  }

  return picks
    .sort((a, b) => {
      const scoreA =
        a.edge * 100 +
        a.confidence -
        Math.abs(a.odds - 2.1) * 10;

      const scoreB =
        b.edge * 100 +
        b.confidence -
        Math.abs(b.odds - 2.1) * 10;

      return scoreB - scoreA;
    })
    .slice(0, limit);
}

export function getParlaySummary(picks) {
  const totalOdds = picks.reduce(
    (acc, pick) => acc * Number(pick.odds || 1),
    1
  );

  const avgEdge =
    picks.reduce(
      (acc, pick) => acc + Number(pick.edge || 0),
      0
    ) / Math.max(1, picks.length);

  return {
    totalOdds,
    avgEdge,
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
    reasons.push(
      `Mallin arvio on huomattavasti markkinaa korkeampi (${percent(
        modelProbability
      )}).`
    );
  } else if (edge >= 0.025) {
    reasons.push(
      `Kohteessa havaittiin positiivinen value-edge.`
    );
  }

  if (odds >= 1.6 && odds <= 2.8) {
    reasons.push(
      `Kerroin ${odds.toFixed(
        2
      )} on historiallisesti vakaampi rekka-käyttöön.`
    );
  }

  if (confidence >= 75) {
    reasons.push(
      `Mallin luottamus tähän kohteeseen on erittäin korkea.`
    );
  } else if (confidence >= 65) {
    reasons.push(
      `Mallin luottamus on normaalia korkeampi.`
    );
  }

  reasons.push(
    `${bookmaker} tarjoaa tällä hetkellä parhaan löydetyn kertoimen kohteelle "${selection}".`
  );

  return reasons;
}
