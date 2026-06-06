export function calculateMarketSentiment({
  modelProbability = 0,
  bookmakerProbability = 0,
  polymarketMarkets = []
}) {
  const bestPolymarket = selectBestPolymarketMarket(polymarketMarkets);

  const polymarketProbability = bestPolymarket?.probability || null;

  const modelVsBookmaker = Number(modelProbability || 0) - Number(bookmakerProbability || 0);
  const modelVsPolymarket =
    polymarketProbability === null
      ? 0
      : Number(modelProbability || 0) - Number(polymarketProbability || 0);

  let sentimentScore = 0;
  const notes = [];

  if (modelVsBookmaker >= 0.08) {
    sentimentScore += 0.025;
    notes.push("Model is meaningfully above bookmaker implied probability.");
  } else if (modelVsBookmaker >= 0.04) {
    sentimentScore += 0.012;
    notes.push("Model is moderately above bookmaker implied probability.");
  } else if (modelVsBookmaker <= -0.08) {
    sentimentScore -= 0.025;
    notes.push("Model is meaningfully below bookmaker implied probability.");
  }

  if (polymarketProbability !== null) {
    if (Math.abs(modelVsPolymarket) <= 0.04) {
      sentimentScore += 0.01;
      notes.push("Polymarket broadly agrees with the model.");
    }

    if (modelVsPolymarket >= 0.1) {
      sentimentScore += 0.015;
      notes.push("Model is far above Polymarket, possible hidden value but verify risk.");
    }

    if (modelVsPolymarket <= -0.1) {
      sentimentScore -= 0.02;
      notes.push("Polymarket is far below the model, possible overconfidence risk.");
    }

    if (Number(bestPolymarket?.liquidity || 0) > 5000) {
      sentimentScore += 0.005;
      notes.push("Polymarket signal has meaningful liquidity.");
    }
  } else {
    notes.push("No usable Polymarket market found for this match.");
  }

  return {
    sentimentScore: clamp(sentimentScore, -0.08, 0.08),
    bookmakerProbability: Number(bookmakerProbability || 0),
    polymarketProbability,
    modelVsBookmaker,
    modelVsPolymarket,
    bestPolymarket,
    notes
  };
}

function selectBestPolymarketMarket(markets = []) {
  if (!Array.isArray(markets) || markets.length === 0) return null;

  return [...markets]
    .filter((market) => Number(market.probability || 0) > 0)
    .sort((a, b) => {
      const liquidityDiff = Number(b.liquidity || 0) - Number(a.liquidity || 0);
      if (liquidityDiff !== 0) return liquidityDiff;
      return Number(b.volume || 0) - Number(a.volume || 0);
    })[0] || null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
