function normalizeMarket(market = {}) {
  return {
    title: market.title || market.question || "Unknown Market",
    probability: Number(
      market.probability ||
      market.price ||
      market.yesPrice ||
      0
    ),
    volume: Number(market.volume || 0),
    liquidity: Number(market.liquidity || 0),
    url: market.url || null
  };
}

export async function fetchPolymarketForMatch({
  homeTeam,
  awayTeam,
  sport,
  league
}) {
  try {
    const query = `${homeTeam} ${awayTeam}`;

    return {
      ok: true,
      source: "placeholder-polymarket",
      mode: "placeholder",
      query,
      data: []
    };
  } catch (error) {
    return {
      ok: false,
      source: "placeholder-polymarket",
      mode: "fetch_error",
      error: error.message,
      data: []
    };
  }
}
