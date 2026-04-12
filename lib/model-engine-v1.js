function impliedProbability(decimalOdds) {
  if (!decimalOdds || decimalOdds <= 1) return null;
  return 1 / decimalOdds;
}

function normalizeTwoWay(aProb, bProb) {
  const total = aProb + bProb;

  if (!total) {
    return {
      a: 0.5,
      b: 0.5,
    };
  }

  return {
    a: aProb / total,
    b: bProb / total,
  };
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

export function getModelProbabilitiesForMatch(match, market = "h2h") {
  if (market === "totals") {
    const overOdds = match?.bestOdds?.over ?? null;
    const underOdds = match?.bestOdds?.under ?? null;

    const impliedOver = impliedProbability(overOdds) ?? 0.51;
    const impliedUnder = impliedProbability(underOdds) ?? 0.49;

    const base = normalizeTwoWay(impliedOver, impliedUnder);

    const adjusted = normalizeTwoWay(
      Math.max(base.a + 0.01, 0.01),
      Math.max(base.b - 0.01, 0.01)
    );

    return {
      over: adjusted.a,
      under: adjusted.b,
      fairOdds: {
        over: Number((1 / adjusted.a).toFixed(2)),
        under: Number((1 / adjusted.b).toFixed(2)),
      },
      confidence: Number((Math.max(adjusted.a, adjusted.b) * 100).toFixed(1)),
    };
  }

  if (market === "spreads") {
    const homeOdds = match?.bestOdds?.spreadHome ?? null;
    const awayOdds = match?.bestOdds?.spreadAway ?? null;

    const impliedHome = impliedProbability(homeOdds) ?? 0.5;
    const impliedAway = impliedProbability(awayOdds) ?? 0.5;

    const base = normalizeTwoWay(impliedHome, impliedAway);

    const adjusted = normalizeTwoWay(
      Math.max(base.a + 0.01, 0.01),
      Math.max(base.b - 0.01, 0.01)
    );

    return {
      spreadHome: adjusted.a,
      spreadAway: adjusted.b,
      fairOdds: {
        spreadHome: Number((1 / adjusted.a).toFixed(2)),
        spreadAway: Number((1 / adjusted.b).toFixed(2)),
      },
      confidence: Number((Math.max(adjusted.a, adjusted.b) * 100).toFixed(1)),
    };
  }

  const homeOdds = match?.bestOdds?.home ?? null;
  const drawOdds = match?.bestOdds?.draw ?? null;
  const awayOdds = match?.bestOdds?.away ?? null;

  const impliedHome = impliedProbability(homeOdds) ?? 0.42;
  const impliedDraw = impliedProbability(drawOdds) ?? 0.24;
  const impliedAway = impliedProbability(awayOdds) ?? 0.34;

  const base = normalizeThreeWay(impliedHome, impliedDraw, impliedAway);

  const adjusted = normalizeThreeWay(
    Math.max(base.home + 0.02, 0.01),
    Math.max(base.draw - 0.01, 0.01),
    Math.max(base.away - 0.01, 0.01)
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

export function buildValueBetRows(match, model, market = "h2h") {
  if (market === "totals") {
    const candidates = [
      {
        side: "OVER",
        team: `Over ${match?.bestOdds?.point ?? "-"}`,
        odds: match?.bestOdds?.over ?? null,
        probability: model?.over,
        bookmaker: match?.bestOdds?.bookmakerOver ?? null,
      },
      {
        side: "UNDER",
        team: `Under ${match?.bestOdds?.point ?? "-"}`,
        odds: match?.bestOdds?.under ?? null,
        probability: model?.under,
        bookmaker: match?.bestOdds?.bookmakerUnder ?? null,
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

  if (market === "spreads") {
    const candidates = [
      {
        side: "SPREAD_HOME",
        team: `${match.home_team} ${match?.bestOdds?.spreadPointHome ?? ""}`,
        odds: match?.bestOdds?.spreadHome ?? null,
        probability: model?.spreadHome,
        bookmaker: match?.bestOdds?.bookmakerSpreadHome ?? null,
      },
      {
        side: "SPREAD_AWAY",
        team: `${match.away_team} ${match?.bestOdds?.spreadPointAway ?? ""}`,
        odds: match?.bestOdds?.spreadAway ?? null,
        probability: model?.spreadAway,
        bookmaker: match?.bestOdds?.bookmakerSpreadAway ?? null,
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
