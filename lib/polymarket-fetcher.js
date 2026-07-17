function normalizeMarket(market = {}) {
  const outcomes = safeJson(market.outcomes, []);
  const outcomePrices = safeJson(market.outcomePrices, []);
  const probability = getBestProbability({ market, outcomes, outcomePrices });

  return {
    id: market.id || market.conditionId || market.slug || null,
    title: market.title || market.question || market.name || "Unknown Market",
    slug: market.slug || null,
    probability,
    volume: Number(market.volume || market.volumeNum || 0),
    liquidity: Number(market.liquidity || market.liquidityNum || 0),
    endDate: market.endDate || market.end_date || null,
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
  const yesIndex = outcomes.findIndex((item) => String(item).toLowerCase() === "yes");
  if (yesIndex >= 0 && outcomePrices[yesIndex] !== undefined) return Number(outcomePrices[yesIndex] || 0);
  if (outcomePrices.length === 2) return Number(outcomePrices[0] || 0);
  return 0;
}

function teamWords(team) {
  return String(team || "").toLowerCase().split(/[^a-z0-9À-ÿ]+/i).filter((word) => word.length >= 4);
}

function isRelevantMarket(market, homeTeam, awayTeam) {
  const text = `${market.question || ""} ${market.title || ""} ${market.description || ""}`.toLowerCase();
  const homeHit = teamWords(homeTeam).some((word) => text.includes(word));
  const awayHit = teamWords(awayTeam).some((word) => text.includes(word));
  return homeHit && awayHit;
}

export async function fetchPolymarketForMatch({ homeTeam, awayTeam }) {
  const query = `${homeTeam} ${awayTeam}`;
  const encoded = encodeURIComponent(query);
  const url = `https://gamma-api.polymarket.com/markets?search=${encoded}&active=true&closed=false&limit=20`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });
    const data = await res.json();

    if (!res.ok) {
      return { ok: false, source: "polymarket", mode: "api_error", status: res.status, query, data: [] };
    }

    const markets = Array.isArray(data) ? data : data?.data || data?.markets || [];
    const relevant = markets.filter((market) => isRelevantMarket(market, homeTeam, awayTeam));

    return {
      ok: true,
      source: "polymarket",
      mode: "live",
      query,
      count: relevant.length,
      data: relevant.slice(0, 10).map(normalizeMarket)
    };
  } catch {
    return { ok: false, source: "polymarket", mode: "fetch_error", query, data: [] };
  }
}
