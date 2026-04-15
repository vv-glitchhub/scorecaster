export function buildConfidenceBreakdown(match, market = "h2h") {
  const homeOdds = Number(match?.bestOdds?.home || 0);
  const awayOdds = Number(match?.bestOdds?.away || 0);
  const drawOdds = Number(match?.bestOdds?.draw || 0);

  const items = [];

  let score = 50;

  const priceGap =
    homeOdds > 0 && awayOdds > 0 ? Math.abs(homeOdds - awayOdds) : 0;

  const marketDepth =
    [homeOdds, awayOdds, drawOdds].filter((x) => Number(x) > 0).length;

  const marketQuality = marketDepth >= 2 ? 8 : -8;
  score += marketQuality;
  items.push({
    label: "Market quality",
    value: marketQuality,
    reason:
      marketDepth >= 2
        ? "Enough odds points are available for comparison."
        : "Limited odds depth reduces confidence.",
  });

  const priceSignal = priceGap > 0.35 ? 10 : priceGap > 0.15 ? 5 : -4;
  score += priceSignal;
  items.push({
    label: "Price separation",
    value: priceSignal,
    reason:
      priceGap > 0.35
        ? "The price difference between sides is meaningful."
        : priceGap > 0.15
        ? "There is some separation in the market."
        : "The market is tight, which lowers clarity.",
  });

  const homeAdvantage = market === "h2h" ? 6 : 3;
  score += homeAdvantage;
  items.push({
    label: "Home advantage",
    value: homeAdvantage,
    reason: "Home side receives a small baseline boost.",
  });

  const volatilityPenalty = drawOdds > 3.8 ? -5 : -2;
  score += volatilityPenalty;
  items.push({
    label: "Volatility penalty",
    value: volatilityPenalty,
    reason:
      drawOdds > 3.8
        ? "Higher long-price volatility increases uncertainty."
        : "Normal market uncertainty is still present.",
  });

  const freshnessBoost = 4;
  score += freshnessBoost;
  items.push({
    label: "Data freshness",
    value: freshnessBoost,
    reason: "Recently refreshed data improves trust in the signal.",
  });

  const normalized = Math.max(1, Math.min(99, score));

  return {
    confidence: normalized,
    items,
  };
}

export function buildRiskFlags(match, market = "h2h") {
  const flags = [];

  const homeOdds = Number(match?.bestOdds?.home || 0);
  const awayOdds = Number(match?.bestOdds?.away || 0);
  const drawOdds = Number(match?.bestOdds?.draw || 0);

  if (!homeOdds || !awayOdds) {
    flags.push({
      level: "high",
      label: "Missing market depth",
      description: "Not enough odds points are available for full comparison.",
    });
  }

  if (market === "h2h" && drawOdds > 4.2) {
    flags.push({
      level: "medium",
      label: "High draw volatility",
      description: "Extreme draw pricing may increase overall market noise.",
    });
  }

  if (homeOdds > 2.8 || awayOdds > 2.8) {
    flags.push({
      level: "medium",
      label: "Underdog volatility",
      description: "Longer prices usually imply higher outcome volatility.",
    });
  }

  if (flags.length === 0) {
    flags.push({
      level: "low",
      label: "No major red flags",
      description: "The current market looks reasonably stable.",
    });
  }

  return flags;
}
