function normalizeMarket(market = {}) {
  const outcomes = safeJson(market.outcomes, []);
  const outcomePrices = safeJson(market.outcomePrices, []);

  const probability = getBestProbability({
    market,
    outcomes,
    outcomePrices
  });

  return {
    id: market.id || market.conditionId || market.slug || null,
    title: market.title || market.question || market.name || "Unknown Market",
    slug: market.slug || null,
    probability,
    volume: Number(market.volume || market.volumeNum || 0),
    liquidity: Number(market.liquidity || market.liquidityNum || 0),
    endDate: market.endDate || market.end_date || null,
    url: market.slug ? `https://polymarket.com/market/${market.slug}` : null,
    rawOutcomes: outcomes,
    rawOutcomePrices: outcomePrices
  };
}

function safeJson(value, fallback) {
  if (Array.isArray(value)) return value;
  if (!value) return fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function getBestProbability({ market, outcomes, outcomePrices }) {
  if (market.probability || market.price || market.yesPrice) {
    return Number(market.probability || market.price || market.yesPrice || 0);
  }

  const yesIndex = outcomes.findIndex(
    (item) => String(item).toLowerCase() === "yes"
  );

  if (yesIndex >= 0 && outcomePrices[yesIndex] !== undefined) {
    return Number(outcomePrices[yesIndex] || 0);
  }

  if (outcomePrices.length === 2) {
    return Number(outcomePrices[0] || 0);
  }

  return 0;
}

function isRelevantMarket(market, homeTeam, awayTeam) {
  const text = `${market.question || ""} ${market.title || ""} ${market.description || ""}`.toLowerCase();
  const home = String(homeTeam || "").toLowerCase();
  const away = String(awayTeam || "").toLowerCase();

  const homeWords = home.split(" ").filter((word) => word.length > 3);
  const awayWords = away.split(" ").filter((word) => word.length > 3);

  const homeHit = homeWords.some((word) => text.includes(word));
  const awayHit = awayWords.some((word) => text.includes(word));

  return homeHit || awayHit;
}

export async function fetchPolymarketForMatch({ homeTeam, awayTeam, sport, league }) {
  const query = `${homeTeam} ${awayTeam}`;
  const encoded = encodeURIComponent(query);
  const url = `https://gamma-api.polymarket.com/markets?search=${encoded}&active=true&closed=false&limit=20`;

  try {
    const res = await fetch(url, {
      cache: "no-store"
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        ok: false,
        source: "polymarket",
        mode: "api_error",
        status: res.status,
        error: data?.message || "Polymarket API error",
        query,
        data: []
      };
    }

    const markets = Array.isArray(data) ? data : data?.data || data?.markets || [];

    const relevant = markets.filter((market) =>
      isRelevantMarket(market, homeTeam, awayTeam)
    );

    const selected = relevant.length ? relevant : markets.slice(0, 5);

    return {
      ok: true,
      source: "polymarket",
      mode: "live",
      query,
      count: selected.length,
      data: selected.slice(0, 10).map(normalizeMarket)
    };
  } catch (error) {
    return {
      ok: false,
      source: "polymarket",
      mode: "fetch_error",
      error: error.message,
      query,
      data: []
    };
  }
}
