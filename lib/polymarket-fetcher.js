function safeJson(value, fallback) {
  if (Array.isArray(value)) return value;
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeMarket(market = {}) {
  const outcomes = safeJson(market.outcomes, []);
  const outcomePrices = safeJson(market.outcomePrices, []);
  const probability = getBestProbability({ market, outcomes, outcomePrices });
  return {
    id: market.id || market.conditionId || market.slug || null,
    title: String(market.title || market.question || market.name || "").slice(0, 220),
    slug: market.slug || null,
    probability,
    volume: Number(market.volume || market.volumeNum || 0),
    liquidity: Number(market.liquidity || market.liquidityNum || 0),
    endDate: market.endDate || market.end_date || null,
    url: market.slug ? `https://polymarket.com/market/${encodeURIComponent(market.slug)}` : null
  };
}

function getBestProbability({ market, outcomes, outcomePrices }) {
  const direct = Number(market.probability ?? market.price ?? market.yesPrice);
  if (Number.isFinite(direct) && direct > 0 && direct < 1) return direct;
  const yesIndex = outcomes.findIndex((item) => String(item).toLowerCase() === "yes");
  const value = yesIndex >= 0 ? Number(outcomePrices[yesIndex]) : NaN;
  return Number.isFinite(value) && value > 0 && value < 1 ? value : 0;
}

function tokens(value) {
  return String(value || "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 4);
}

function teamMention(text, team) {
  const values = tokens(team);
  if (!values.length) return false;
  return values.filter((token) => text.includes(token)).length >= Math.max(1, Math.ceil(values.length / 2));
}

function isRelevantMarket(market, homeTeam, awayTeam) {
  const text = `${market.question || ""} ${market.title || ""} ${market.description || ""}`.toLowerCase();
  return teamMention(text, homeTeam) && teamMention(text, awayTeam);
}

export async function fetchPolymarketForMatch({ homeTeam, awayTeam }) {
  const retrievedAt = new Date().toISOString();
  if (process.env.ENABLE_EXTERNAL_MARKET_CONTEXT !== "true") {
    return {
      ok: true,
      source: "external-market-context-disabled",
      mode: "disabled",
      retrievedAt,
      data: []
    };
  }

  const query = `${homeTeam} ${awayTeam}`.trim();
  const url = `https://gamma-api.polymarket.com/markets?search=${encodeURIComponent(query)}&active=true&closed=false&limit=20`;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });
    const data = await response.json();
    if (!response.ok) {
      return {
        ok: false,
        source: "polymarket",
        mode: "api_error",
        status: response.status,
        error: "External market request failed",
        retrievedAt,
        data: []
      };
    }

    const markets = Array.isArray(data) ? data : data?.data || data?.markets || [];
    const selected = markets
      .filter((market) => isRelevantMarket(market, homeTeam, awayTeam))
      .map(normalizeMarket)
      .filter((market) => market.title && market.probability > 0 && market.probability < 1)
      .slice(0, 5);

    return {
      ok: true,
      source: "polymarket",
      mode: "live",
      query,
      retrievedAt,
      count: selected.length,
      data: selected
    };
  } catch (error) {
    return {
      ok: false,
      source: "polymarket",
      mode: "fetch_error",
      error: error instanceof Error ? error.message : "External market request failed",
      query,
      retrievedAt,
      data: []
    };
  }
}
