function impliedProbability(decimalOdds) {
  if (!decimalOdds || decimalOdds <= 1) return null;
  return 1 / decimalOdds;
}

function normalizeThreeWay(homeProb, drawProb, awayProb) {
  const total = homeProb + drawProb + awayProb;

  if (!total) {
    return {
      home: 0.33,
      draw: 0.22,
      away: 0.45,
    };
  }

  return {
    home: homeProb / total,
    draw: drawProb / total,
    away: awayProb / total,
  };
}

export function getModelProbabilitiesForMatch(match) {
  const homeOdds = match?.bestOdds?.home ?? null;
  const drawOdds = match?.bestOdds?.draw ?? null;
  const awayOdds = match?.bestOdds?.away ?? null;

  const impliedHome = impliedProbability(homeOdds) ?? 0.42;
  const impliedDraw = impliedProbability(drawOdds) ?? 0.24;
  const impliedAway = impliedProbability(awayOdds) ?? 0.34;

  const base = normalizeThreeWay(impliedHome, impliedDraw, impliedAway);

  const homeBoost = 0.02;
  const drawPenalty = 0.01;
  const awayPenalty = 0.01;

  const adjusted = normalizeThreeWay(
    Math.max(base.home + homeBoost, 0.01),
    Math.max(base.draw - drawPenalty, 0.01),
    Math.max(base.away - awayPenalty, 0.01)
  );

  return {
    home: adjusted.home,
    draw: adjusted.draw,
    away: adjusted.away,
    fairOdds: {
      home: Number((1 / adjusted.home).toFixed(2)),
      draw: Number((1 / adjusted.draw).toFixed(2)),
      away: Number((1 / adjusted.away).toFixed(2)),
    },
    confidence: Number(
      (Math.max(adjusted.home, adjusted.draw, adjusted.away) * 100).toFixed(1)
    ),
  };
}

export function buildValueBetRows(match, model) {
  const candidates = [
    {
      side: "HOME",
      team: match.home_team,
      odds: match?.bestOdds?.home ?? null,
      probability: model.home,
      bookmaker: match?.bestOdds?.bookmakerHome ?? null,
    },
    {
      side: "DRAW",
      team: "Draw",
      odds: match?.bestOdds?.draw ?? null,
      probability: model.draw,
      bookmaker: match?.bestOdds?.bookmakerDraw ?? null,
    },
    {
      side: "AWAY",
      team: match.away_team,
      odds: match?.bestOdds?.away ?? null,
      probability: model.away,
      bookmaker: match?.bestOdds?.bookmakerAway ?? null,
    },
  ];

  return candidates
    .filter((row) => row.odds && row.probability)
    .map((row) => {
      const expectedValue = row.odds * row.probability - 1;

      return {
        ...row,
        expectedValue: Number(expectedValue.toFixed(4)),
        edgePct: Number((expectedValue * 100).toFixed(2)),
        fairOdds: Number((1 / row.probability).toFixed(2)),
      };
    })
    .sort((a, b) => b.expectedValue - a.expectedValue);
}
