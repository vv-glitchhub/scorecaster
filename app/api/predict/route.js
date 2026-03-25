import { NextResponse } from "next/server";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function normalizeProbs(probs) {
  const safe = probs.map((p) => Math.max(0.01, p));
  const sum = safe.reduce((a, b) => a + b, 0);
  return safe.map((p) => (p / sum) * 100);
}

function impliedProbFromOdds(decimalOdds) {
  if (!decimalOdds || decimalOdds <= 1) return 0;
  return 100 / decimalOdds;
}

function getBestOdds(game) {
  const best = {};

  for (const bookmaker of game.bookmakers || []) {
    for (const market of bookmaker.markets || []) {
      if (market.key !== "h2h") continue;

      for (const outcome of market.outcomes || []) {
        const current = best[outcome.name];
        if (!current || outcome.price > current.price) {
          best[outcome.name] = {
            name: outcome.name,
            price: outcome.price,
            bookmaker: bookmaker.title
          };
        }
      }
    }
  }

  return Object.values(best);
}

function getOutcomePrice(bestOdds, outcomeName) {
  const found = bestOdds.find((o) => o.name === outcomeName);
  return found ? found.price : null;
}

function getMarketProbMap(game, bestOdds) {
  const homeName = game.home;
  const awayName = game.away;
  const drawEntry = bestOdds.find((o) => o.name === "Draw");

  const raw = [];
  const labels = [];

  const homeOdds = getOutcomePrice(bestOdds, homeName);
  const awayOdds = getOutcomePrice(bestOdds, awayName);

  if (homeOdds) {
    raw.push(impliedProbFromOdds(homeOdds));
    labels.push(homeName);
  }

  if (drawEntry) {
    raw.push(impliedProbFromOdds(drawEntry.price));
    labels.push("Draw");
  }

  if (awayOdds) {
    raw.push(impliedProbFromOdds(awayOdds));
    labels.push(awayName);
  }

  const normalized = normalizeProbs(raw);

  const probMap = {};
  labels.forEach((label, i) => {
    probMap[label] = normalized[i];
  });

  return probMap;
}

function applyFactorAdjustments({
  selectedFactors,
  homeProb,
  drawProb,
  awayProb
}) {
  let h = homeProb;
  let d = drawProb;
  let a = awayProb;

  for (const factor of selectedFactors || []) {
    const f = String(f).toLowerCase();

    if (f.includes("koti") || f.includes("home")) {
      h += 3;
      a -= 2;
      d -= 1;
    }

    if (f.includes("loukka") || f.includes("injured") || f.includes("key player")) {
      h -= 2;
      a += 2;
    }

    if (f.includes("derby")) {
      if (drawProb > 0) {
        d += 2;
        h -= 1;
        a -= 1;
      }
    }

    if (f.includes("goalkeeper") || f.includes("goalie") || f.includes("maalivahti")) {
      h += 2;
      a -= 1;
    }

    if (f.includes("back-to-back") || f.includes("fatigue") || f.includes("väs")) {
      h -= 1.5;
      a += 1.5;
    }

    if (f.includes("puolustus") || f.includes("defense")) {
      if (drawProb > 0) {
        d += 1.5;
        h -= 0.75;
        a -= 0.75;
      }
    }

    if (
      f.includes("motivaatio") ||
      f.includes("new coach") ||
      f.includes("uusi valmentaja") ||
      f.includes("ylivoima") ||
      f.includes("3-pisteet")
    ) {
      h += 1.5;
      a -= 1;
      d -= 0.5;
    }
  }

  const normalized = normalizeProbs([h, d, a]);
  return {
    homeProb: normalized[0],
    drawProb: normalized[1],
    awayProb: normalized[2]
  };
}

function buildValueBets(bestOdds, modelProbMap, marketProbMap) {
  const bets = [];

  for (const odd of bestOdds) {
    const modelProb = modelProbMap[odd.name];
    const marketProb = marketProbMap[odd.name];

    if (modelProb == null || marketProb == null) continue;

    const edge = round(modelProb - marketProb, 1);

    if (edge >= 1) {
      bets.push({
        outcome: odd.name,
        odds: odd.price,
        bookmaker: odd.bookmaker,
        modelProb: round(modelProb, 1),
        marketProb: round(marketProb, 1),
        edge
      });
    }
  }

  bets.sort((a, b) => b.edge - a.edge);
  return bets;
}

function confidenceFromContext(bestEdge, selectedFactorsCount, hasDraw) {
  let score = 0;

  if (bestEdge >= 6) score += 3;
  else if (bestEdge >= 3) score += 2;
  else if (bestEdge >= 1.5) score += 1;

  if (selectedFactorsCount >= 3) score += 1;
  if (!hasDraw) score += 0.5;

  if (score >= 3.5) return "KORKEA";
  if (score >= 2) return "KOHTALAINEN";
  return "MATALA";
}

function makeRecommendation(bestBet, game) {
  if (!bestBet) return "NO BET";
  if (bestBet.outcome === game.home) return "LEAN HOME";
  if (bestBet.outcome === game.away) return "LEAN AWAY";
  if (bestBet.outcome === "Draw") return "LEAN DRAW";
  return "NO BET";
}

function buildAnalysis({
  game,
  confidence,
  bestBet,
  homeWinProb,
  drawProb,
  awayWinProb,
  selectedFactors
}) {
  const parts = [];

  parts.push(
    `${game.home} vs ${game.away} looks ${
      confidence === "KORKEA"
        ? "fairly strong"
        : confidence === "KOHTALAINEN"
          ? "moderately readable"
          : "more uncertain"
    } from a model perspective.`
  );

  parts.push(
    `The model makes the matchup ${round(homeWinProb, 0)}% - ${
      drawProb > 0 ? `${round(drawProb, 0)}% - ` : ""
    }${round(awayWinProb, 0)}%.`
  );

  if (bestBet) {
    parts.push(
      `The clearest value signal appears on ${bestBet.outcome} at odds ${bestBet.odds}, with model probability ${bestBet.modelProb}% versus market ${bestBet.marketProb}%.`
    );
  } else {
    parts.push(
      `At the moment the market and model are fairly close, so no strong value signal stands out.`
    );
  }

  if (selectedFactors?.length) {
    parts.push(`Selected factors affecting the view: ${selectedFactors.join(", ")}.`);
  }

  return parts.join("\n\n");
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { game, selectedFactors = [], sport } = body || {};

    if (!game || !game.home || !game.away) {
      return NextResponse.json({ error: "Missing game data" }, { status: 400 });
    }

    const bestOdds = getBestOdds(game);

    if (!bestOdds.length) {
      return NextResponse.json(
        { error: "No odds available for this game" },
        { status: 400 }
      );
    }

    const marketProbMap = getMarketProbMap(game, bestOdds);
    const hasDraw = marketProbMap["Draw"] != null;

    let baseHomeProb = marketProbMap[game.home] ?? 50;
    let baseDrawProb = marketProbMap["Draw"] ?? 0;
    let baseAwayProb = marketProbMap[game.away] ?? 50;

    if (!hasDraw) {
      const normalizedTwoWay = normalizeProbs([baseHomeProb, baseAwayProb]);
      baseHomeProb = normalizedTwoWay[0];
      baseAwayProb = normalizedTwoWay[1];
      baseDrawProb = 0;
    }

    const adjusted = applyFactorAdjustments({
      selectedFactors,
      homeProb: baseHomeProb,
      drawProb: baseDrawProb,
      awayProb: baseAwayProb
    });

    const homeWinProb = round(adjusted.homeProb, 1);
    const drawProb = hasDraw ? round(adjusted.drawProb, 1) : 0;
    const awayWinProb = round(adjusted.awayProb, 1);

    const modelProbMap = {
      [game.home]: homeWinProb,
      [game.away]: awayWinProb
    };

    if (hasDraw) modelProbMap["Draw"] = drawProb;

    const valueBets = buildValueBets(bestOdds, modelProbMap, marketProbMap);
    const bestBet = valueBets.length ? valueBets[0] : null;
    const bestEdge = bestBet ? bestBet.edge : 0;

    const confidence = confidenceFromContext(
      bestEdge,
      selectedFactors.length,
      hasDraw
    );

    const homeStrength = clamp(Math.round(homeWinProb / 10), 1, 10);
    const awayStrength = clamp(Math.round(awayWinProb / 10), 1, 10);

    const homeXG = round(clamp((homeWinProb / 100) * 2.8, 0.4, 3.2), 2);
    const awayXG = round(clamp((awayWinProb / 100) * 2.8, 0.4, 3.2), 2);

    const response = {
      homeScore: Math.max(0, Math.round(homeXG)),
      awayScore: Math.max(0, Math.round(awayXG)),
      homeWinProb,
      awayWinProb,
      drawProb,
      recommendation: makeRecommendation(bestBet, game),
      confidence,
      bestBet,
      valueBets,
      homeStrength,
      awayStrength,
      xgLabel: `${homeXG} - ${awayXG}`,
      homeXG,
      awayXG,
      keyFactor: selectedFactors[0] || (sport || "Market and home edge"),
      stats: {
        homeLast5: game.homeForm || ["W", "W", "L", "D", "W"],
        awayLast5: game.awayForm || ["L", "W", "L", "W", "D"],
        h2h: game.h2h || "Balanced recent meetings"
      },
      analysis: buildAnalysis({
        game,
        confidence,
        bestBet,
        homeWinProb,
        drawProb,
        awayWinProb,
        selectedFactors
      })
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Prediction failed" },
      { status: 500 }
    );
  }
}
