import { NextResponse } from "next/server";

function impliedProb(odds) {
  return 100 / odds;
}

function normalizeProbs(probs) {
  const sum = probs.reduce((a, b) => a + b, 0);
  return probs.map((p) => (p / sum) * 100);
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { game, selectedFactors } = body;

    const odds = game.odds || [
      { name: game.home, price: 2.1 },
      { name: game.away, price: 1.8 }
    ];

    // 📊 MARKET PROBS
    let marketProbs = odds.map((o) => impliedProb(o.price));
    marketProbs = normalizeProbs(marketProbs);

    // 🧠 MODEL LOGIC (simple but realistic base)
    let modelHome = marketProbs[0];
    let modelAway = marketProbs[1];

    // 🔧 FACTOR ADJUSTMENTS
    if (selectedFactors.includes("Kotikenttäetu") || selectedFactors.includes("Home advantage")) {
      modelHome += 3;
      modelAway -= 3;
    }

    if (selectedFactors.includes("Avainpelaaja loukkaantunut") || selectedFactors.includes("Key player injured")) {
      modelHome -= 2;
      modelAway += 2;
    }

    // normalize again
    let modelProbs = normalizeProbs([modelHome, modelAway]);

    const homeProb = Math.round(modelProbs[0]);
    const awayProb = Math.round(modelProbs[1]);

    // 💰 EDGE
    const edgeHome = homeProb - Math.round(marketProbs[0]);
    const edgeAway = awayProb - Math.round(marketProbs[1]);

    // 🔥 BEST BET
    let bestBet = null;

    if (edgeHome > 3) {
      bestBet = {
        outcome: game.home,
        odds: odds[0].price,
        modelProb: homeProb,
        marketProb: Math.round(marketProbs[0]),
        edge: edgeHome
      };
    }

    if (edgeAway > 3) {
      bestBet = {
        outcome: game.away,
        odds: odds[1].price,
        modelProb: awayProb,
        marketProb: Math.round(marketProbs[1]),
        edge: edgeAway
      };
    }

    // 📊 CONFIDENCE
    let confidence = "MATALA";
    if (Math.max(edgeHome, edgeAway) > 6) confidence = "KORKEA";
    else if (Math.max(edgeHome, edgeAway) > 3) confidence = "KOHTALAINEN";

    return NextResponse.json({
      homeScore: Math.round(homeProb / 10),
      awayScore: Math.round(awayProb / 10),

      homeWinProb: homeProb,
      awayWinProb: awayProb,

      confidence,

      recommendation: bestBet
        ? edgeHome > edgeAway
          ? "LEAN HOME"
          : "LEAN AWAY"
        : "NO BET",

      bestBet,
      valueBets: bestBet ? [bestBet] : [],

      homeStrength: Math.round(homeProb / 10),
      awayStrength: Math.round(awayProb / 10),

      analysis: `Model vs market comparison shows ${
        bestBet ? "a small edge" : "no clear edge"
      }. Market probability differs from model estimation.`

    });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
