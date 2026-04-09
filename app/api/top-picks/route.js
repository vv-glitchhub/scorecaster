import { NextResponse } from "next/server";
import { getOddsData } from "../../../lib/odds-service";
import { getModelProbabilitiesForMatch } from "../../../lib/model-engine-v1";
import { rankValueBets, buildValueBets } from "../../../lib/betting/value-engine";

function normalizeOutcomeName(name) {
  const value = String(name ?? "").trim();
  if (!value) return "";
  const lower = value.toLowerCase();
  if (lower === "draw" || lower === "tie" || lower === "x") return "Draw";
  return value;
}

function getLeagueLabelFromSportKey(sportKey) {
  const map = {
    icehockey_liiga: "Liiga",
    icehockey_nhl: "NHL",
    icehockey_allsvenskan: "Allsvenskan",
    icehockey_sweden_hockey_league: "SHL",
    basketball_nba: "NBA",
    basketball_euroleague: "EuroLeague",
    basketball_ncaab: "NCAA",
    soccer_epl: "Premier League",
    soccer_spain_la_liga: "La Liga",
    soccer_italy_serie_a: "Serie A",
    soccer_germany_bundesliga: "Bundesliga",
    americanfootball_nfl: "NFL",
    americanfootball_ncaaf: "NCAA Football",
  };

  return map[sportKey] ?? sportKey ?? "Unknown";
}

function getH2hOutcomes(match) {
  const bookmakers = Array.isArray(match?.bookmakers) ? match.bookmakers : [];

  const bestByOutcome = new Map();

  for (const bookmaker of bookmakers) {
    const markets = Array.isArray(bookmaker?.markets) ? bookmaker.markets : [];
    const h2h = markets.find((m) => m?.key === "h2h");
    const outcomes = Array.isArray(h2h?.outcomes) ? h2h.outcomes : [];

    for (const outcome of outcomes) {
      const name = normalizeOutcomeName(outcome?.name);
      const odds = Number(outcome?.price ?? outcome?.odds);

      if (!name || !Number.isFinite(odds) || odds <= 1) continue;

      if (!bestByOutcome.has(name) || odds > bestByOutcome.get(name).odds) {
        bestByOutcome.set(name, {
          name,
          odds,
          price: odds,
          bookmaker: bookmaker?.title ?? "Unknown",
        });
      }
    }
  }

  return Array.from(bestByOutcome.values());
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedGroup = searchParams.get("group") || "icehockey";

    const defaultSportByGroup = {
      icehockey: "icehockey_liiga",
      basketball: "basketball_nba",
      soccer: "soccer_epl",
      americanfootball: "americanfootball_nfl",
    };

    const payload = await getOddsData({
      requestedSport: defaultSportByGroup[requestedGroup] || "icehockey_liiga",
      requestedGroup,
    });

    const matches = Array.isArray(payload?.data) ? payload.data : [];

    const picks = [];

    for (const match of matches) {
      const outcomes = getH2hOutcomes(match);
      if (outcomes.length === 0) continue;

      const model = await getModelProbabilitiesForMatch({
        match,
        oddsData: match,
      });

      const modelProbabilities = Object.fromEntries(
        Object.entries(model).filter(([key, value]) => key !== "debug" && Number.isFinite(Number(value)))
      );

      const bets = rankValueBets(
        buildValueBets({
          matchLabel: `${match.home_team} vs ${match.away_team}`,
          marketKey: "h2h",
          bookmaker: "Best market",
          outcomes,
          modelProbabilitiesByOutcome: modelProbabilities,
          bankroll: 1000,
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
      );

      const best = bets[0];
      if (!best) continue;

      picks.push({
        id: `${match.id}-${best.outcomeName}`,
        leagueLabel: getLeagueLabelFromSportKey(match.sport_key),
        sport_key: match.sport_key,
        home_team: match.home_team,
        away_team: match.away_team,
        commence_time: match.commence_time,
        outcome: best.outcomeName,
        odds: best.odds,
        bookmaker: best.bookmaker,
        edge: best.edge,
        ev: best.ev,
        kelly: best.kelly,
        modelProbability: best.modelProbability,
        marketProbability: best.marketProbability,
        fairOdds: best.fairOdds,
        confidence: best.confidence,
        level: best.level,
        score:
          Number(best.confidence || 0) * 10 +
          Number(best.edge || 0) * 1000 +
          Number(best.ev || 0) * 700 +
          Number(best.kelly || 0) * 200,
      });
    }

    picks.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      ok: true,
      source: payload?.source ?? "demo",
      data: picks.slice(0, 12),
      debug: {
        requestedGroup,
        source: payload?.source ?? "demo",
        rawMatches: matches.length,
        picksCount: picks.length,
      },
    });
  } catch (error) {
    return NextResponse.json({
      ok: true,
      source: "demo",
      data: [],
      debug: {
        error: error?.message ?? "Unknown error",
      },
    });
  }
}
