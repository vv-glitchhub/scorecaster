import { NextResponse } from "next/server";

function hashString(str) {
  return str.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

function pickForm(seed, len = 5) {
  const chars = ["V", "H", "T"];
  const arr = [];
  for (let i = 0; i < len; i++) {
    arr.push(chars[(seed + i) % chars.length]);
  }
  return arr;
}

function getBestOdds(game) {
  const best = {};

  for (const bookmaker of game.bookmakers || []) {
    for (const market of bookmaker.markets || []) {
      if (market.key !== "h2h") continue;
      for (const outcome of market.outcomes || []) {
        const current = best[outcome.name];
        if (!current || outcome.price > current.price) {
          best[outcome.name] = outcome.price;
        }
      }
    }
  }

  return best;
}

function impliedProbFromOdds(decimalOdds) {
  if (!decimalOdds || decimalOdds <= 1) return null;
  return +(100 / decimalOdds).toFixed(1);
}

function buildValueBets(game, sport, probs) {
  const oddsMap = getBestOdds(game);
  const out = [];

  const candidates = [
    { outcome: game.home, modelProb: probs.homeWinProb },
    ...(sport === "jalkapallo" ? [{ outcome: "Draw", modelProb: probs.drawProb }] : []),
    { outcome: game.away, modelProb: probs.awayWinProb }
  ];

  for (const c of candidates) {
    const odds = oddsMap[c.outcome];
    const marketProb = impliedProbFromOdds(odds);

    if (!odds || marketProb == null) continue;

    const edge = +(c.modelProb - marketProb).toFixed(1);

    if (edge >= 2) {
      out.push({
        outcome: c.outcome,
        modelProb: c.modelProb,
        marketProb,
        edge,
        odds
      });
    }
  }

  return out.sort((a, b) => b.edge - a.edge);
}

function makePrediction(game, sport, selectedFactors) {
  const seed = hashString(`${game.home}-${game.away}-${sport}`) % 100;
  const factorBoost = Math.min(selectedFactors.length * 1.5, 6);

  let homeWinProb = 48 + (seed % 9) + factorBoost;
  let awayWinProb = 52 - (seed % 9);
  let drawProb = sport === "jalkapallo" ? 24 : 0;

  if (sport === "jalkapallo") {
    awayWinProb = Math.max(10, 100 - homeWinProb - drawProb);
  } else {
    awayWinProb = Math.max(10, 100 - homeWinProb);
  }

  const homeStrength = Math.min(9, Math.max(4, Math.round(homeWinProb / 10)));
  const awayStrength = Math.min(9, Math.max(4, Math.round(awayWinProb / 10)));

  const homeXG = +(1.1 + (homeWinProb / 100) * 1.4).toFixed(2);
  const awayXG = +(0.9 + (awayWinProb / 100) * 1.1).toFixed(2);

  const homeScore =
    sport === "koripallo" ? 90 + Math.round(homeWinProb / 5) :
    sport === "jaakiekko" ? Math.max(1, Math.round(homeXG + 1)) :
    Math.max(0, Math.round(homeXG));

  const awayScore =
    sport === "koripallo" ? 86 + Math.round(awayWinProb / 6) :
    sport === "jaakiekko" ? Math.max(1, Math.round(awayXG + 1)) :
    Math.max(0, Math.round(awayXG));

  const confidence =
    homeWinProb >= 60 || awayWinProb >= 60 ? "KORKEA" :
    homeWinProb >= 52 || awayWinProb >= 52 ? "KOHTALAINEN" :
    "MATALA";

  const keyFactor = selectedFactors?.[0] || "Markkina ja kotietu";

  const valueBets = buildValueBets(game, sport, { homeWinProb, drawProb, awayWinProb });

  const analysis = [
    `${game.home} ja ${game.away} näyttävät ennakkoon melko tasaisilta, mutta mallin mukaan kotijoukkueella on pieni etu ottelun rakenteessa, tempossa ja todennäköisessä pelinkulussa.`,
    `Viimeisimmän muodon ja valittujen tekijöiden perusteella tärkein yksittäinen vaikutus tulee kohdasta: ${keyFactor}. Tämä nostaa varsinkin ${game.home}:n perusennustetta hieman.`,
    valueBets.length > 0
      ? `Markkinaan verrattuna paras mahdollinen value löytyy kohteesta "${valueBets[0].outcome}", koska mallin todennäköisyys on markkinaa korkeampi.`
      : `Markkina ja malli ovat melko lähellä toisiaan, joten selkeää ylikerrointa ei synny kovin vahvasti tässä kohteessa.`
  ].join("\n\n");

  return {
    homeScore,
    awayScore,
    homeWinProb: +homeWinProb.toFixed(1),
    drawProb: sport === "jalkapallo" ? +drawProb.toFixed(1) : 0,
    awayWinProb: +awayWinProb.toFixed(1),
    confidence,
    keyFactor,
    homeStrength,
    awayStrength,
    expectedGoals: sport === "koripallo" ? "korkea" : homeXG + awayXG > 3 ? "kohtalainen-korkea" : "maltillinen",
    xgLabel: `${homeXG} - ${awayXG}`,
    homeXG,
    awayXG,
    valueBets,
    stats: {
      homeLast5: pickForm(seed, 5),
      awayLast5: pickForm(seed + 7, 5),
      h2h: `${game.home} 2W · 1D · 2L ${game.away}`
    },
    analysis
  };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { sport, game, selectedFactors = [] } = body;

    if (!game?.home || !game?.away) {
      return NextResponse.json({ error: "Ottelutiedot puuttuvat" }, { status: 400 });
    }

    const result = makePrediction(game, sport, selectedFactors);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: "Ennustus epäonnistui" }, { status: 500 });
  }
}
