function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function impliedProbability(odds) {
  const n = toNumber(odds);
  if (n == null || n <= 1) return null;
  return 1 / n;
}

function getMarketOdds(match, market) {
  if (market === "totals") {
    return {
      over: toNumber(match?.bestOdds?.over),
      under: toNumber(match?.bestOdds?.under),
    };
  }

  if (market === "spreads") {
    return {
      spreadHome: toNumber(match?.bestOdds?.spreadHome),
      spreadAway: toNumber(match?.bestOdds?.spreadAway),
    };
  }

  return {
    home: toNumber(match?.bestOdds?.home),
    draw: toNumber(match?.bestOdds?.draw),
    away: toNumber(match?.bestOdds?.away),
  };
}

export function buildConfidenceBreakdown(match, market = "h2h") {
  const odds = getMarketOdds(match, market);

  if (market === "totals") {
    const overProb = impliedProbability(odds.over);
    const underProb = impliedProbability(odds.under);

    const items = [
      {
        label: "Price balance",
        value:
          overProb != null && underProb != null
            ? Number(((1 - Math.abs(overProb - underProb)) * 12).toFixed(1))
            : 0,
        reason: "Balanced totals pricing usually means a more stable market.",
      },
      {
        label: "Line availability",
        value: match?.bestOdds?.point != null ? 8 : -6,
        reason: "A visible totals line improves readability and comparison.",
      },
      {
        label: "Market completeness",
        value:
          odds.over != null && odds.under != null ? 10 : -10,
        reason: "Both sides available improves confidence.",
      },
    ];

    const rawScore = items.reduce((sum, item) => sum + item.value, 50);
    return {
      confidence: clamp(Math.round(rawScore), 1, 99),
      items,
    };
  }

  if (market === "spreads") {
    const homeProb = impliedProbability(odds.spreadHome);
    const awayProb = impliedProbability(odds.spreadAway);

    const items = [
      {
        label: "Spread balance",
        value:
          homeProb != null && awayProb != null
            ? Number(((1 - Math.abs(homeProb - awayProb)) * 12).toFixed(1))
            : 0,
        reason: "Balanced spread pricing usually means less noisy pricing.",
      },
      {
        label: "Line visibility",
        value:
          match?.bestOdds?.spreadPointHome != null || match?.bestOdds?.spreadPointAway != null
            ? 8
            : -6,
        reason: "Clear spread points help interpretation.",
      },
      {
        label: "Two-way completeness",
        value:
          odds.spreadHome != null && odds.spreadAway != null ? 10 : -10,
        reason: "Both sides available improves confidence.",
      },
    ];

    const rawScore = items.reduce((sum, item) => sum + item.value, 50);
    return {
      confidence: clamp(Math.round(rawScore), 1, 99),
      items,
    };
  }

  const homeProb = impliedProbability(odds.home);
  const drawProb = impliedProbability(odds.draw);
  const awayProb = impliedProbability(odds.away);

  const hasDraw = odds.draw != null;
  const marketComplete = odds.home != null && odds.away != null;

  const items = [
    {
      label: "Market completeness",
      value: marketComplete ? 12 : -14,
      reason: "Both main sides must be available for solid comparison.",
    },
    {
      label: "Draw availability",
      value: hasDraw ? 8 : -4,
      reason: "Three-way markets are more interpretable when draw odds exist.",
    },
    {
      label: "Price balance",
      value:
        homeProb != null && awayProb != null
          ? Number(((1 - Math.abs(homeProb - awayProb)) * 10).toFixed(1))
          : 0,
      reason: "Less distorted prices often produce cleaner signals.",
    },
    {
      label: "Book shape",
      value:
        homeProb != null && awayProb != null && drawProb != null
          ? 9
          : 3,
      reason: "A fully shaped 3-way market usually gives stronger baseline confidence.",
    },
  ];

  const rawScore = items.reduce((sum, item) => sum + item.value, 48);
  return {
    confidence: clamp(Math.round(rawScore), 1, 99),
    items,
  };
}

export function buildRiskFlags(match, market = "h2h") {
  const flags = [];

  if (!match?.bestOdds) {
    return [
      {
        level: "high",
        label: "Missing odds data",
        description: "The market data is incomplete for this match.",
      },
    ];
  }

  if (market === "totals") {
    if (match?.bestOdds?.point == null) {
      flags.push({
        level: "medium",
        label: "Missing totals line",
        description: "Totals prices exist but the points line is not clearly available.",
      });
    }

    if (match?.bestOdds?.over == null || match?.bestOdds?.under == null) {
      flags.push({
        level: "high",
        label: "Incomplete totals market",
        description: "One side of the totals market is missing.",
      });
    }
  }

  if (market === "spreads") {
    if (match?.bestOdds?.spreadHome == null || match?.bestOdds?.spreadAway == null) {
      flags.push({
        level: "high",
        label: "Incomplete spread market",
        description: "One side of the spread market is missing.",
      });
    }

    if (
      match?.bestOdds?.spreadPointHome == null &&
      match?.bestOdds?.spreadPointAway == null
    ) {
      flags.push({
        level: "medium",
        label: "Missing spread points",
        description: "Spread prices are present but the line values are unclear.",
      });
    }
  }

  if (market === "h2h") {
    if (match?.bestOdds?.home == null || match?.bestOdds?.away == null) {
      flags.push({
        level: "high",
        label: "Incomplete H2H market",
        description: "The head-to-head market is missing one of the main sides.",
      });
    }

    if (match?.bestOdds?.draw == null) {
      flags.push({
        level: "low",
        label: "No draw price",
        description: "This may be normal in some sports, but it limits three-way interpretation.",
      });
    }
  }

  if (flags.length === 0) {
    flags.push({
      level: "low",
      label: "No major structural issues",
      description: "The currently selected market looks structurally usable.",
    });
  }

  return flags;
}
