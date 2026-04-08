// app/api/analyze/route.js

import { NextResponse } from "next/server";
import { buildValueBets } from "@/lib/betting/value-engine";
import { getModelProbabilitiesForMatch } from "@/lib/model-engine-v1"; // käytä sinun nykyistä funktiota / polkua

export async function POST(req) {
  try {
    const body = await req.json();
    const { match, oddsData, bankroll } = body;

    if (!match || !oddsData) {
      return NextResponse.json(
        { error: "Missing match or oddsData" },
        { status: 400 }
      );
    }

    // Tämä oletetaan olevan sinun nykyinen mallifunktio.
    // Sen pitäisi palauttaa esim:
    // {
    //   home: 0.47,
    //   draw: 0.24,
    //   away: 0.29
    // }
    const modelProbabilitiesByOutcome = await getModelProbabilitiesForMatch({
      match,
      oddsData,
    });

    const h2hMarket = oddsData?.bookmakers?.[0]?.markets?.find(
      (market) => market.key === "h2h"
    );

    const bookmaker = oddsData?.bookmakers?.[0]?.title ?? "Unknown";

    const valueBets = buildValueBets({
      match: `${match.home_team} vs ${match.away_team}`,
      marketKey: "h2h",
      bookmaker,
      outcomes: h2hMarket?.outcomes ?? [],
      modelProbabilitiesByOutcome: modelProbabilitiesByOutcome ?? {},
      config: {
        minOdds: 1.01,
        maxOdds: 100,
        maxKellyFraction: 0.25,
        minEdgeToBet: 0.015,
        minEvToBet: 0.01,
      },
    }).map((bet) => ({
      ...bet,
      stake:
        bankroll && bet.kelly
          ? Number((bankroll * bet.kelly).toFixed(2))
          : 0,
    }));

    const bestBet = valueBets.find((bet) => bet.isBet) ?? null;

    return NextResponse.json({
      ok: true,
      match: {
        home_team: match.home_team,
        away_team: match.away_team,
        commence_time: match.commence_time,
      },
      model: {
        probabilities: modelProbabilitiesByOutcome ?? {},
      },
      valueBets,
      bestBet,
      debug: {
        bookmaker,
        market: "h2h",
        outcomesCount: h2hMarket?.outcomes?.length ?? 0,
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
