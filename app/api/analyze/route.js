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

function extractBookmakers(input) {
  if (Array.isArray(input?.bookmakers)) return input.bookmakers;
  if (Array.isArray(input?.data?.bookmakers)) return input.data.bookmakers;
  if (Array.isArray(input?.oddsData?.bookmakers)) return input.oddsData.bookmakers;
  return [];
}

function getAllH2HMarkets(oddsData) {
  const bookmakers = extractBookmakers(oddsData);
  const rows = [];

  for (const bookmaker of bookmakers) {
    const markets = Array.isArray(bookmaker?.markets) ? bookmaker.markets : [];
    const h2h = markets.find((market) => market?.key === "h2h");
    if (!h2h?.outcomes?.length) continue;

    rows.push({
      bookmakerKey: bookmaker?.key ?? null,
      bookmakerTitle: bookmaker?.title ?? "Unknown",
      marketKey: "h2h",
      outcomes: h2h.outcomes
        .map((outcome) => ({
          ...outcome,
          name: normalizeDrawName(outcome?.name),
          odds: Number(outcome?.price ?? outcome?.odds),
        }))
        .filter((outcome) => Number.isFinite(outcome.odds)),
    });
  }

  return rows.filter((row) => row.outcomes.length > 0);
}

function getBestOddsRows(oddsData, match) {
  const bookmakers = extractBookmakers(oddsData);

  const best = {
    [match?.home_team]: null,
    [match?.away_team]: null,
    Draw: null,
  };

  for (const bookmaker of bookmakers) {
    const h2h = bookmaker?.markets?.find((market) => market?.key === "h2h");
    if (!h2h?.outcomes) continue;

    for (const outcome of h2h.outcomes) {
      const key = normalizeDrawName(outcome?.name);
      const odds = Number(outcome?.price ?? outcome?.odds);
      if (!Number.isFinite(odds)) continue;
      if (!(key in best)) continue;

      if (!best[key] || odds > best[key].odds) {
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

function buildFallbackBookmakers(match) {
  return [
    {
      key: "demo",
      title: "DemoBook",
      markets: [
        {
          key: "h2h",
          outcomes: [
            { name: match.home_team, price: 2.25 },
            { name: match.away_team, price: 1.78 },
          ],
        },
      ],
    },
  ];
}

function buildFallbackAnalyzeFromBestOdds({ match, bestOdds, bankroll }) {
  if (!bestOdds.length) return [];

  const baseModel = {
    [match.home_team]: 0.496,
    [match.away_team]: 0.504,
    Draw: 0.2,
  };

  const usable = bestOdds.filter((x) => Number.isFinite(Number(x.odds)) && Number(x.odds) > 1);
  const overround = usable.reduce((sum, row) => sum + 1 / Number(row.odds), 0);

  return usable.map((row) => {
    const odds = Number(row.odds);
    const marketProbability = overround > 0 ? (1 / odds) / overround : 0.5;
    const modelProbability = baseModel[row.outcomeName] ?? 0.5;
    const edge = modelProbability - marketProbability;
    const ev = modelProbability * odds - 1;
    const b = odds - 1;
    const q = 1 - modelProbability;
    const kellyRaw = b > 0 ? ((b * modelProbability) - q) / b : 0;
    const kelly = Math.max(0, Math.min(kellyRaw, 0.25));
    const recommendedStake = Number((bankroll * kelly).toFixed(2));
    const isBet = edge >= 0.005 && ev >= 0.005;

    return {
      match: buildMatchLabel(match),
      marketKey: "h2h",
      outcomeName: row.outcomeName,
      bookmaker: row.bookmaker,
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
      confidence: Math.max(0, Math.min(100, Math.round(20 + edge * 900 + ev * 500))),
      grade: isBet ? "C" : "F",
      reasonTag: "fallback",
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

    if (!match) {
      return NextResponse.json(
        { ok: false, error: "Missing match" },
        { status: 400 }
      );
    }

    let normalizedOddsData = {
      ...oddsData,
      bookmakers: extractBookmakers(oddsData),
    };

    if (!normalizedOddsData.bookmakers.length) {
      normalizedOddsData.bookmakers = buildFallbackBookmakers(match);
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
            [match.home_team]: 0.496,
            [match.away_team]: 0.504,
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

    const bestOdds = getBestOddsRows(normalizedOddsData, match);

    if (!valueBets.length) {
      valueBets = buildFallbackAnalyzeFromBestOdds({
        match,
        bestOdds,
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

    let topPicks = sortedValueBets.filter((bet) => bet.isBet).slice(0, 3);
    if (topPicks.length === 0) {
      topPicks = sortedValueBets.slice(0, 3);
    }

    const bestBet =
      sortedValueBets.find((bet) => bet.isBet) ??
      sortedValueBets[0] ??
      null;

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
