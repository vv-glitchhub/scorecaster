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

    const normalizedOddsData = {
      ...oddsData,
      bookmakers: Array.isArray(oddsData?.bookmakers)
        ? oddsData.bookmakers
        : Array.isArray(oddsData?.data?.bookmakers)
        ? oddsData.data.bookmakers
        : [],
    };

    if (!normalizedOddsData.bookmakers.length) {
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

    const modelProbabilitiesByOutcome = mapModelProbabilitiesToOutcomeNames(
      match,
      rawModel
    );

    const h2hMarkets = getAllH2HMarkets(normalizedOddsData);
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

    const bestBet = sortedValueBets.find((bet) => bet.isBet) ?? null;
    const bestOdds = getBestOddsRows(normalizedOddsData, match);
    const topPicks = sortedValueBets.filter((bet) => bet.isBet).slice(0, 3);

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
      topPicks,
      valueBets: sortedValueBets,
      debug: {
        bookmakersCount: normalizedOddsData.bookmakers.length,
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
