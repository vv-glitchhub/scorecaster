import { NextResponse } from "next/server";
import { buildValueBets } from "../../../lib/betting/value-engine";
import { mapModelProbabilitiesToOutcomeNames } from "../../../lib/betting/outcome-mapper";
import { getModelProbabilitiesForMatch } from "../../../lib/model-engine-v1";

function buildMatchLabel(match) {
  if (!match) return "Unknown match";
  return `${match.home_team} vs ${match.away_team}`;
}

function normalizeDrawName(name) {
  const lower = String(name ?? "").trim().toLowerCase();
  return lower === "draw" || lower === "tie" ? "Draw" : name;
}

function getNormalizedBookmakers(oddsData) {
  if (Array.isArray(oddsData?.bookmakers)) return oddsData.bookmakers;
  if (Array.isArray(oddsData?.data?.bookmakers)) return oddsData.data.bookmakers;
  if (Array.isArray(oddsData?.bookmaker_data)) return oddsData.bookmaker_data;
  return [];
}

function getAllH2HMarkets(oddsData) {
  const bookmakers = getNormalizedBookmakers(oddsData);
  const result = [];

  for (const bookmaker of bookmakers) {
    const markets = Array.isArray(bookmaker?.markets) ? bookmaker.markets : [];
    const h2h = markets.find((market) => market?.key === "h2h");
    if (!h2h?.outcomes?.length) continue;

    const outcomes = h2h.outcomes
      .map((outcome) => {
        const odds = Number(outcome?.price ?? outcome?.odds);
        if (!Number.isFinite(odds)) return null;

        return {
          ...outcome,
          name: normalizeDrawName(outcome?.name),
          odds,
        };
      })
      .filter(Boolean);

    if (!outcomes.length) continue;

    result.push({
      bookmakerKey: bookmaker?.key ?? null,
      bookmakerTitle: bookmaker?.title ?? "Unknown",
      marketKey: h2h?.key ?? "h2h",
      outcomes,
    });
  }

  return result;
}

function getBestOddsRows(oddsData, match) {
  const bookmakers = getNormalizedBookmakers(oddsData);

  const best = {
    [match?.home_team]: null,
    [match?.away_team]: null,
    Draw: null,
  };

  for (const bookmaker of bookmakers) {
    const h2h = bookmaker?.markets?.find((market) => market?.key === "h2h");
    if (!h2h?.outcomes) continue;

    for (const outcome of h2h.outcomes) {
      const odds = Number(outcome?.price ?? outcome?.odds);
      if (!Number.isFinite(odds)) continue;

      const key = normalizeDrawName(String(outcome?.name ?? "").trim());
      if (!(key in best)) continue;

      const current = best[key];
      if (!current || odds > current.odds) {
        best[key] = {
          outcomeName: key,
          odds,
          bookmaker: bookmaker?.title ?? "Unknown",
        };
      }
    }
  }

  return Object.values(best).filter(Boolean);
}

function buildFallbackBookmakersFromBestOdds(bestOddsRows) {
  if (!Array.isArray(bestOddsRows) || !bestOddsRows.length) return [];

  return [
    {
      key: "fallback-book",
      title: "FallbackBook",
      markets: [
        {
          key: "h2h",
          outcomes: bestOddsRows.map((row) => ({
            name: normalizeDrawName(row.outcomeName),
            odds: Number(row.odds),
          })),
        },
      ],
    },
  ];
}

function buildFallbackValueBetsFromBestOdds({ match, bestOddsRows, bankroll }) {
  if (!Array.isArray(bestOddsRows) || !bestOddsRows.length) return [];

  const defaultModel = {
    [match.home_team]: 0.45,
    [match.away_team]: 0.35,
    Draw: 0.2,
  };

  const totalRaw = bestOddsRows.reduce((sum, row) => {
    const odds = Number(row.odds);
    return Number.isFinite(odds) && odds > 1 ? sum + 1 / odds : sum;
  }, 0);

  return bestOddsRows.map((row, index) => {
    const odds = Number(row.odds);
    const marketProbability =
      Number.isFinite(odds) && odds > 1 && totalRaw > 0 ? (1 / odds) / totalRaw : 0.33;

    const modelProbability = defaultModel[normalizeDrawName(row.outcomeName)] ?? 0.33;
    const edge = modelProbability - marketProbability;
    const ev = modelProbability * odds - 1;
    const b = odds - 1;
    const q = 1 - modelProbability;
    const rawKelly = b > 0 ? ((b * modelProbability) - q) / b : 0;
    const kelly = Math.max(0, Math.min(rawKelly, 0.25));
    const recommendedStake = bankroll > 0 ? Number((bankroll * kelly).toFixed(2)) : 0;
    const isBet = edge >= 0.005 && ev >= 0.005;
    const confidence = Math.max(0, Math.min(100, Math.round(20 + edge * 900 + ev * 500)));

    return {
      match: buildMatchLabel(match),
      marketKey: "h2h",
      outcomeName: normalizeDrawName(row.outcomeName),
      bookmaker: row.bookmaker ?? "FallbackBook",
      odds: Number(odds.toFixed(2)),
      fairOdds: Number((1 / modelProbability).toFixed(3)),
      modelProbability: Number(modelProbability.toFixed(4)),
      marketProbability: Number(marketProbability.toFixed(4)),
      edge: Number(edge.toFixed(4)),
      ev: Number(ev.toFixed(4)),
      kelly: Number(kelly.toFixed(4)),
      recommendedStake,
      isBet,
      status: isBet ? "bet" : "no_bet",
      noBetReasons: isBet ? [] : ["fallback_model"],
      confidence,
      grade: isBet ? (edge >= 0.08 ? "A" : edge >= 0.05 ? "B" : edge >= 0.025 ? "C" : "D") : "F",
      reasonTag: "fallback",
      _fallback: true,
      _rank: index + 1,
    };
  });
}

export async function POST(req) {
  try {
    const body = await req.json();

    const match = body?.match ?? null;
    const oddsData = body?.oddsData ?? null;
    const bankroll = Number(body?.bankroll ?? 0);
    const teamRatings = body?.teamRatings ?? null;

    if (!match || !oddsData) {
      return NextResponse.json({ ok: false, error: "Missing match or oddsData" }, { status: 400 });
    }

    let normalizedOddsData = {
      ...oddsData,
      bookmakers: getNormalizedBookmakers(oddsData),
    };

    let bestOdds = getBestOddsRows(normalizedOddsData, match);

    if (!normalizedOddsData.bookmakers.length && bestOdds.length) {
      normalizedOddsData = {
        ...normalizedOddsData,
        bookmakers: buildFallbackBookmakersFromBestOdds(bestOdds),
      };
    }

    if (!bestOdds.length) {
      bestOdds = getBestOddsRows(normalizedOddsData, match);
    }

    if (!normalizedOddsData.bookmakers.length && !bestOdds.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid oddsData shape",
          debug: {
            hasOddsData: Boolean(oddsData),
            oddsDataKeys: oddsData ? Object.keys(oddsData) : [],
          },
        },
        { status: 400 }
      );
    }

    const rawModel = await getModelProbabilitiesForMatch({
      match,
      oddsData: normalizedOddsData,
      teamRatings,
    });

    const mappedModel = mapModelProbabilitiesToOutcomeNames(match, rawModel);

    const safeModelProbabilities =
      mappedModel && Object.keys(mappedModel).length > 0
        ? mappedModel
        : {
            [match.home_team]: 0.45,
            [match.away_team]: 0.35,
            Draw: 0.2,
          };

    const h2hMarkets = getAllH2HMarkets(normalizedOddsData);
    const matchLabel = buildMatchLabel(match);

    let valueBets = h2hMarkets.flatMap((market) =>
      buildValueBets({
        matchLabel,
        marketKey: market.marketKey,
        bookmaker: market.bookmakerTitle,
        outcomes: market.outcomes,
        modelProbabilitiesByOutcome: safeModelProbabilities,
        bankroll,
        config: {
          minOdds: 1.01,
          maxOdds: 100,
          minProbability: 0.0001,
          maxProbability: 0.9999,
          minEdgeToBet: 0.005,
          minEvToBet: 0.005,
          maxKellyFraction: 0.25,
        },
      })
    );

    if (!valueBets.length && bestOdds.length) {
      valueBets = buildFallbackValueBetsFromBestOdds({
        match,
        bestOddsRows: bestOdds,
        bankroll,
      });
    }

    const sortedValueBets = [...valueBets].sort((a, b) => {
      const aScore =
        (a.isBet ? 1000 : 0) +
        (a.confidence ?? 0) * 10 +
        (a.ev ?? -999) * 100 +
        (a.edge ?? -999);

      const bScore =
        (b.isBet ? 1000 : 0) +
        (b.confidence ?? 0) * 10 +
        (b.ev ?? -999) * 100 +
        (b.edge ?? -999);

      return bScore - aScore;
    });

    const bestBet = sortedValueBets.find((bet) => bet.isBet) ?? sortedValueBets[0] ?? null;

    let topPicks = sortedValueBets.filter((bet) => bet.isBet).slice(0, 3);
    if (topPicks.length === 0) {
      topPicks = sortedValueBets.slice(0, 3);
    }

    return NextResponse.json({
      ok: true,
      match: {
        home_team: match.home_team,
        away_team: match.away_team,
        commence_time: match.commence_time ?? null,
      },
      model: {
        raw: rawModel,
        mapped: safeModelProbabilities,
      },
      bestOdds,
      bestBet,
      topPicks,
      valueBets: sortedValueBets,
      debug: {
        bookmakersCount: normalizedOddsData.bookmakers.length,
        h2hMarketsCount: h2hMarkets.length,
        valueBetsCount: sortedValueBets.length,
        topPicksCount: topPicks.length,
        usedFallbackValueBets: !h2hMarkets.length || valueBets.some((x) => x._fallback),
      },
    });
  } catch (error) {
    console.error("Analyze route error:", error);

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
