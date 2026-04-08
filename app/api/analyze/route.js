// app/api/analyze/route.js

import { NextResponse } from "next/server";
import { buildValueBets } from "@/lib/betting/value-engine";
import { mapModelProbabilitiesToOutcomeNames } from "@/lib/betting/outcome-mapper";
import { getModelProbabilitiesForMatch } from "@/lib/model-engine-v1";

function buildMatchLabel(match) {
  if (!match) return "Unknown match";
  return `${match.home_team} vs ${match.away_team}`;
}

function getAllH2HMarkets(oddsData) {
  const bookmakers = Array.isArray(oddsData?.bookmakers)
    ? oddsData.bookmakers
    : [];

  const result = [];

  for (const bookmaker of bookmakers) {
    const markets = Array.isArray(bookmaker?.markets) ? bookmaker.markets : [];
    const h2h = markets.find((market) => market?.key === "h2h");
    if (!h2h?.outcomes?.length) continue;

    result.push({
      bookmakerKey: bookmaker?.key ?? null,
      bookmakerTitle: bookmaker?.title ?? "Unknown",
      marketKey: h2h?.key ?? "h2h",
      outcomes: h2h.outcomes,
    });
  }

  return result;
}

function getBestOddsRows(oddsData, match) {
  const bookmakers = Array.isArray(oddsData?.bookmakers)
    ? oddsData.bookmakers
    : [];

  const best = {
    [match?.home_team]: null,
    [match?.away_team]: null,
    Draw: null,
  };

  for (const bookmaker of bookmakers) {
    const h2h = bookmaker?.markets?.find((market) => market?.key === "h2h");
    if (!h2h?.outcomes) continue;

    for (const outcome of h2h.outcomes) {
      const name = String(outcome?.name ?? "").trim();
      const odds = Number(outcome?.price ?? outcome?.odds);
      if (!Number.isFinite(odds)) continue;

      let key = name;
      if (name.toLowerCase() === "draw" || name.toLowerCase() === "tie") {
        key = "Draw";
      }

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

export async function POST(req) {
  try {
    const body = await req.json();

    const match = body?.match ?? null;
    const oddsData = body?.oddsData ?? null;
    const bankroll = Number(body?.bankroll ?? 0);
    const teamRatings = body?.teamRatings ?? null;

    if (!match || !oddsData) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing match or oddsData",
        },
        { status: 400 }
      );
    }

    const rawModel = await getModelProbabilitiesForMatch({
      match,
      oddsData,
      teamRatings,
    });

    const modelProbabilitiesByOutcome = mapModelProbabilitiesToOutcomeNames(
      match,
      rawModel
    );

    const h2hMarkets = getAllH2HMarkets(oddsData);
    const matchLabel = buildMatchLabel(match);

    const valueBets = h2hMarkets.flatMap((market) =>
      buildValueBets({
        matchLabel,
        marketKey: market.marketKey,
        bookmaker: market.bookmakerTitle,
        outcomes: market.outcomes,
        modelProbabilitiesByOutcome,
        bankroll,
        config: {
          minOdds: 1.01,
          maxOdds: 100,
          minProbability: 0.0001,
          maxProbability: 0.9999,
          minEdgeToBet: 0.015,
          minEvToBet: 0.01,
          maxKellyFraction: 0.25,
        },
      })
    );

    const sortedValueBets = [...valueBets].sort((a, b) => {
      const aScore = (a.isBet ? 1000 : 0) + (a.ev ?? -999) * 100 + (a.edge ?? -999);
      const bScore = (b.isBet ? 1000 : 0) + (b.ev ?? -999) * 100 + (b.edge ?? -999);
      return bScore - aScore;
    });

    const bestBet = sortedValueBets.find((bet) => bet.isBet) ?? null;
    const bestOdds = getBestOddsRows(oddsData, match);

    return NextResponse.json({
      ok: true,
      match: {
        home_team: match.home_team,
        away_team: match.away_team,
        commence_time: match.commence_time ?? null,
      },
      model: {
        raw: rawModel,
        mapped: modelProbabilitiesByOutcome,
      },
      bestOdds,
      bestBet,
      valueBets: sortedValueBets,
      debug: {
        bookmakersCount: Array.isArray(oddsData?.bookmakers)
          ? oddsData.bookmakers.length
          : 0,
        h2hMarketsCount: h2hMarkets.length,
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
