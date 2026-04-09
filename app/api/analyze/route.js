import { NextResponse } from "next/server";
import {
  buildValueBets,
  summarizeValueBets,
  rankValueBets,
} from "../../../lib/betting/value-engine";
import {
  mapModelProbabilitiesToOutcomeNames,
  normalizeOutcomeName,
} from "../../../lib/betting/outcome-mapper";

const globalForAnalyzeCache = globalThis;

if (!globalForAnalyzeCache.__scorecasterAnalyzeCache) {
  globalForAnalyzeCache.__scorecasterAnalyzeCache = new Map();
}

const analyzeCache = globalForAnalyzeCache.__scorecasterAnalyzeCache;
const ANALYZE_CACHE_TTL_MS = 5 * 60 * 1000;

function cleanupAnalyzeCache() {
  const now = Date.now();

  for (const [key, value] of analyzeCache.entries()) {
    if (!value?.createdAt || now - value.createdAt > ANALYZE_CACHE_TTL_MS) {
      analyzeCache.delete(key);
    }
  }
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function buildMatchLabel(match) {
  if (!match) return "Unknown match";
  return `${match.home_team} vs ${match.away_team}`;
}

function extractBookmakers(input) {
  if (Array.isArray(input?.bookmakers)) return input.bookmakers;
  if (Array.isArray(input?.data?.bookmakers)) return input.data.bookmakers;
  if (Array.isArray(input?.oddsData?.bookmakers)) return input.oddsData.bookmakers;
  return [];
}

function buildFallbackBookmakers(match) {
  const isSoccer = String(match?.sport_key ?? "").startsWith("soccer_");

  return [
    {
      key: "demo",
      title: "DemoBook",
      markets: [
        {
          key: "h2h",
          outcomes: isSoccer
            ? [
                { name: match.home_team, price: 2.55 },
                { name: "Draw", price: 3.35 },
                { name: match.away_team, price: 2.75 },
              ]
            : [
                { name: match.home_team, price: 2.25 },
                { name: match.away_team, price: 1.78 },
              ],
        },
      ],
    },
  ];
}

function getAllH2HMarkets(oddsData) {
  const bookmakers = extractBookmakers(oddsData);
  const rows = [];

  for (const bookmaker of bookmakers) {
    const markets = Array.isArray(bookmaker?.markets) ? bookmaker.markets : [];
    const h2h = markets.find((market) => market?.key === "h2h");

    if (!h2h?.outcomes?.length) continue;

    const outcomes = h2h.outcomes
      .map((outcome) => {
        const odds = safeNumber(outcome?.price ?? outcome?.odds, NaN);
        if (!Number.isFinite(odds) || odds <= 1) return null;

        return {
          ...outcome,
          name: normalizeOutcomeName(outcome?.name),
          odds,
          price: odds,
        };
      })
      .filter(Boolean);

    if (outcomes.length === 0) continue;

    rows.push({
      bookmakerKey: bookmaker?.key ?? null,
      bookmakerTitle: bookmaker?.title ?? "Unknown",
      marketKey: "h2h",
      outcomes,
    });
  }

  return rows;
}

function getBestOddsRows(oddsData, match) {
  const bookmakers = extractBookmakers(oddsData);
  const best = new Map();

  for (const bookmaker of bookmakers) {
    const markets = Array.isArray(bookmaker?.markets) ? bookmaker.markets : [];
    const h2h = markets.find((market) => market?.key === "h2h");
    if (!h2h?.outcomes?.length) continue;

    for (const outcome of h2h.outcomes) {
      const outcomeName = normalizeOutcomeName(outcome?.name);
      const odds = safeNumber(outcome?.price ?? outcome?.odds, NaN);

      if (!outcomeName || !Number.isFinite(odds) || odds <= 1) continue;

      if (!best.has(outcomeName) || odds > best.get(outcomeName).odds) {
        best.set(outcomeName, {
          outcomeName,
          odds,
          bookmaker: bookmaker?.title ?? "Unknown",
        });
      }
    }
  }

  const orderedNames = [
    normalizeOutcomeName(match?.home_team),
    "Draw",
    normalizeOutcomeName(match?.away_team),
  ].filter(Boolean);

  return orderedNames
    .map((name) => best.get(name))
    .filter(Boolean);
}

function getCacheKey({ match, bankroll, oddsData }) {
  const bookmakers = extractBookmakers(oddsData);

  const oddsFingerprint = bookmakers.map((bookmaker) => ({
    key: bookmaker?.key ?? bookmaker?.title ?? "unknown",
    markets: (bookmaker?.markets ?? [])
      .filter((market) => market?.key === "h2h")
      .map((market) => ({
        key: market?.key,
        outcomes: (market?.outcomes ?? []).map((outcome) => ({
          name: normalizeOutcomeName(outcome?.name),
          price: safeNumber(outcome?.price ?? outcome?.odds, 0),
        })),
      })),
  }));

  return JSON.stringify({
    id: match?.id ?? null,
    home_team: match?.home_team ?? null,
    away_team: match?.away_team ?? null,
    commence_time: match?.commence_time ?? null,
    bankroll: safeNumber(bankroll, 0),
    oddsFingerprint,
  });
}

function getFallbackModelProbabilities(match, hasDraw = false) {
  if (hasDraw) {
    return {
      [normalizeOutcomeName(match?.home_team)]: 0.42,
      Draw: 0.24,
      [normalizeOutcomeName(match?.away_team)]: 0.34,
    };
  }

  return {
    [normalizeOutcomeName(match?.home_team)]: 0.52,
    [normalizeOutcomeName(match?.away_team)]: 0.48,
  };
}

function buildSimpleModelProbabilities(match, h2hMarkets) {
  const allOutcomes = h2hMarkets.flatMap((m) => m.outcomes ?? []);
  const hasDraw = allOutcomes.some((o) => normalizeOutcomeName(o?.name) === "Draw");
  const fallback = getFallbackModelProbabilities(match, hasDraw);

  const availableNames = new Set(
    allOutcomes.map((o) => normalizeOutcomeName(o?.name)).filter(Boolean)
  );

  const filtered = {};
  for (const [key, value] of Object.entries(fallback)) {
    if (availableNames.has(key)) filtered[key] = value;
  }

  const entries = Object.entries(filtered);
  if (entries.length === 0) return fallback;

  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (total <= 0) return fallback;

  return Object.fromEntries(
    entries.map(([key, value]) => [key, value / total])
  );
}

function buildProSummary(valueBets) {
  const summary = summarizeValueBets(valueBets);

  return {
    ...summary,
    buckets: {
      strong: valueBets.filter((x) => x.level === "strong").length,
      playable: valueBets.filter((x) => x.level === "playable").length,
      skip: valueBets.filter((x) => x.level === "skip").length,
    },
  };
}

export async function POST(req) {
  try {
    cleanupAnalyzeCache();

    const body = await req.json();
    const match = body?.match ?? null;
    const bankroll = safeNumber(body?.bankroll, 0);

    if (!match?.home_team || !match?.away_team) {
      return NextResponse.json(
        { ok: false, error: "Missing match" },
        { status: 400 }
      );
    }

    let normalizedOddsData = {
      ...(body?.oddsData ?? match),
      bookmakers: extractBookmakers(body?.oddsData ?? match),
    };

    if (!normalizedOddsData.bookmakers.length) {
      normalizedOddsData.bookmakers = buildFallbackBookmakers(match);
    }

    const cacheKey = getCacheKey({
      match,
      bankroll,
      oddsData: normalizedOddsData,
    });

    const cached = analyzeCache.get(cacheKey);

    if (cached && Date.now() - cached.createdAt < ANALYZE_CACHE_TTL_MS) {
      return NextResponse.json({
        ...cached.payload,
        debug: {
          ...(cached.payload.debug ?? {}),
          cacheHit: true,
          cacheTtlMs: ANALYZE_CACHE_TTL_MS,
        },
      });
    }

    const h2hMarkets = getAllH2HMarkets(normalizedOddsData);
    const matchLabel = buildMatchLabel(match);

    const mappedModelProbabilities = mapModelProbabilitiesToOutcomeNames(
      match,
      buildSimpleModelProbabilities(match, h2hMarkets)
    );

    const valueBets = rankValueBets(
      h2hMarkets.flatMap((market) =>
        buildValueBets({
          matchLabel,
          marketKey: market.marketKey,
          bookmaker: market.bookmakerTitle,
          outcomes: market.outcomes,
          modelProbabilitiesByOutcome: mappedModelProbabilities,
          bankroll,
          config: {
            minOdds: 1.01,
            maxOdds: 100,
            minProbability: 0.0001,
            maxProbability: 0.9999,
            minEdgeToBet: 0.01,
            minEvToBet: 0.005,
            maxKellyFraction: 0.25,
          },
        })
      )
    );

    const topPicks = valueBets.filter((bet) => bet.level !== "skip").slice(0, 3);
    const bestBet = topPicks[0] ?? valueBets[0] ?? null;
    const bestOdds = getBestOddsRows(normalizedOddsData, match);

    const payload = {
      ok: true,
      match: {
        home_team: match.home_team,
        away_team: match.away_team,
        commence_time: match.commence_time ?? null,
      },
      model: {
        mapped: mappedModelProbabilities,
      },
      bestOdds,
      bestBet,
      topPicks,
      valueBets,
      proSummary: buildProSummary(valueBets),
      debug: {
        cacheHit: false,
        cacheTtlMs: ANALYZE_CACHE_TTL_MS,
        bookmakersCount: normalizedOddsData.bookmakers.length,
        h2hMarketsCount: h2hMarkets.length,
        valueBetsCount: valueBets.length,
        topPicksCount: topPicks.length,
        modelProbabilities: mappedModelProbabilities,
        bestBetReason: bestBet?.reasonTag ?? null,
      },
    };

    analyzeCache.set(cacheKey, {
      createdAt: Date.now(),
      payload,
    });

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Analyze failed",
        details: error?.message ?? "Unknown error",
      },
      { status: 500 }
    );
  }
}
