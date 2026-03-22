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
        outcome: c.outcome === "Draw" ? "Tasapeli" : c.outcome,
        rawOutcome: c.outcome,
        modelProb: c.modelProb,
        marketProb,
        edge,
        odds
      });
    }
  }

  return out.sort((a, b) => b.edge - a.edge);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function poissonApprox(lambda, seedShift = 0) {
  const seed = Math.abs(Math.sin(lambda * 12.9898 + seedShift * 78.233));
  const r = seed - Math.floor(seed);

  if (lambda < 0.8) {
    if (r < 0.45) return 0;
    if (r < 0.82) return 1;
    if (r < 0.95) return 2;
    return 3;
  }

  if (lambda < 1.3) {
    if (r < 0.22) return 0;
    if (r < 0.58) return 1;
    if (r < 0.84) return 2;
    if (r < 0.95) return 3;
    return 4;
  }

  if (lambda < 1.9) {
    if (r < 0.12) return 0;
    if (r < 0.36) return 1;
    if (r < 0.66) return 2;
    if (r < 0.86) return 3;
    if (r < 0.96) return 4;
    return 5;
  }

  if (r < 0.08) return 0;
  if (r < 0.24) return 1;
  if (r < 0.48) return 2;
  if (r < 0.72) return 3;
  if (r < 0.88) return 4;
  if (r < 0.96) return 5;
  return 6;
}

function makePrediction(game, sport, selectedFactors) {
  const seed = hashString(`${game.home}-${game.away}-${sport}`);
  const factorBoost = Math.min(selectedFactors.length * 1.2, 5);

  const oddsMap = getBestOdds(game);
  const homeOdds = oddsMap[game.home];
  const drawOdds = oddsMap["Draw"];
  const awayOdds = oddsMap[game.away];

  let homeWinProb;
  let awayWinProb;
  let drawProb = 0;

  if (homeOdds && awayOdds) {
    const homeImp = impliedProbFromOdds(homeOdds) || 33;
    const awayImp = impliedProbFromOdds(awayOdds) || 33;
    const drawImp = sport === "jalkapallo" ? (impliedProbFromOdds(drawOdds) || 26) : 0;

    homeWinProb = homeImp + 4 + factorBoost - ((seed % 5) * 0.6);
    awayWinProb = awayImp - 2 + (((seed >> 1) % 4) * 0.5);
    drawProb = drawImp;

    if (sport === "jalkapallo") {
      const total = homeWinProb + awayWinProb + drawProb;
      homeWinProb = (homeWinProb / total) * 100;
      awayWinProb = (awayWinProb / total) * 100;
      drawProb = (drawProb / total) * 100;
    } else {
      const total = homeWinProb + awayWinProb;
      homeWinProb = (homeWinProb / total) * 100;
      awayWinProb = (awayWinProb / total) * 100;
    }
  } else {
    homeWinProb = 47 + (seed % 12) + factorBoost;
    awayWinProb = 53 - (seed % 12);

    if (sport === "jalkapallo") {
      drawProb = 22 + (seed % 7);
      const total = homeWinProb + awayWinProb + drawProb;
      homeWinProb = (homeWinProb / total) * 100;
      awayWinProb = (awayWinProb / total) * 100;
      drawProb = (drawProb / total) * 100;
    } else {
      const total = homeWinProb + awayWinProb;
      homeWinProb = (homeWinProb / total) * 100;
      awayWinProb = (awayWinProb / total) * 100;
    }
  }

  homeWinProb = +clamp(homeWinProb, 5, 85).toFixed(1);
  awayWinProb = +clamp(awayWinProb, 5, 85).toFixed(1);
  drawProb = sport === "jalkapallo" ? +clamp(drawProb, 8, 35).toFixed(1) : 0;

  if (sport === "jalkapallo") {
    const total = homeWinProb + awayWinProb + drawProb;
    homeWinProb = +(homeWinProb / total * 100).toFixed(1);
    awayWinProb = +(awayWinProb / total * 100).toFixed(1);
    drawProb = +(drawProb / total * 100).toFixed(1);
  }

  const homeStrength = clamp(Math.round(homeWinProb / 10), 3, 9);
  const awayStrength = clamp(Math.round(awayWinProb / 10), 3, 9);

  let homeScore = 0;
  let awayScore = 0;
  let homeXG = 0;
  let awayXG = 0;
  let xgLabel = "";

  if (sport === "jalkapallo") {
    homeXG = +(0.55 + (homeWinProb / 100) * 2.05 + factorBoost * 0.04).toFixed(2);
    awayXG = +(0.45 + (awayWinProb / 100) * 1.85).toFixed(2);

    homeScore = poissonApprox(homeXG, seed % 13);
    awayScore = poissonApprox(awayXG, seed % 17);

    if (Math.abs(homeWinProb - awayWinProb) < 7 && drawProb > 24) {
      if ((seed % 3) === 0) {
        homeScore = 1;
        awayScore = 1;
      } else if ((seed % 5) === 0) {
        homeScore = 0;
        awayScore = 0;
      }
    }

    if (homeWinProb > awayWinProb + 12 && homeScore <= awayScore) {
      homeScore = awayScore + 1;
    }
    if (awayWinProb > homeWinProb + 12 && awayScore <= homeScore) {
      awayScore = homeScore + 1;
    }

    xgLabel = `${homeXG} - ${awayXG}`;
  }

  if (sport === "jaakiekko") {
    homeXG = +(1.6 + (homeWinProb / 100) * 2.1 + factorBoost * 0.05).toFixed(2);
    awayXG = +(1.4 + (awayWinProb / 100) * 2.0).toFixed(2);

    homeScore = clamp(poissonApprox(homeXG, seed % 19) + 1, 1, 7);
    awayScore = clamp(poissonApprox(awayXG, seed % 23) + 1, 1, 7);

    if (homeWinProb > awayWinProb + 10 && homeScore <= awayScore) {
      homeScore = awayScore + 1;
    }
    if (awayWinProb > homeWinProb + 10 && awayScore <= homeScore) {
      awayScore = homeScore + 1;
    }

    xgLabel = `${homeXG} - ${awayXG}`;
  }

  if (sport === "koripallo") {
    const paceBase = 84 + (seed % 18);
    const attackSpread = Math.round((homeWinProb - awayWinProb) / 2.5);

    homeScore = clamp(paceBase + 6 + attackSpread + (seed % 7), 78, 128);
    awayScore = clamp(paceBase + 2 - attackSpread + ((seed >> 2) % 8), 74, 124);

    if (homeWinProb > awayWinProb && homeScore <= awayScore) {
      homeScore = awayScore + (1 + (seed % 6));
    }
    if (awayWinProb > homeWinProb && awayScore <= homeScore) {
      awayScore = homeScore + (1 + (seed % 6));
    }

    homeXG = +(homeScore / 50).toFixed(2);
    awayXG = +(awayScore / 50).toFixed(2);
    xgLabel = `${homeScore + awayScore} pts`;
  }

  const confidence =
    Math.abs(homeWinProb - awayWinProb) >= 18
      ? "KORKEA"
      : Math.abs(homeWinProb - awayWinProb) >= 8
        ? "KOHTALAINEN"
        : "MATALA";

  const keyFactor = selectedFactors?.[0] || "Markkina ja kotietu";

  const valueBets = buildValueBets(game, sport, {
    homeWinProb,
    drawProb,
    awayWinProb
  });

  const bestBet = valueBets[0] || null;

  const analysis = [
    `${game.home} ja ${game.away} muodostavat ennakkoon kiinnostavan kohteen, jossa markkina, kotietu ja ottelun todennäköinen pelinkuva vaikuttavat lopputulokseen enemmän kuin yksittäinen narratiivi.`,
    `Valituista tekijöistä suurin vaikutus tulee kohdasta: ${keyFactor}. Tämä näkyy mallissa erityisesti voittotodennäköisyyksien painotuksessa ja arvioidussa piste- tai maalimäärässä.`,
    bestBet
      ? `PRO MODE löytää parhaaksi pelattavaksi vaihtoehdoksi kohteen "${bestBet.outcome}", koska mallin arvio (${bestBet.modelProb}%) on markkinan implisiittistä arviota (${bestBet.marketProb}%) korkeampi.`
      : `Tässä kohteessa markkina ja malli ovat melko lähellä toisiaan, joten hyvin vahvaa ylikerrointa ei muodostu.`
  ].join("\n\n");

  return {
    homeScore,
    awayScore,
    homeWinProb,
    drawProb: sport === "jalkapallo" ? drawProb : 0,
    awayWinProb,
    confidence,
    keyFactor,
    homeStrength,
    awayStrength,
    expectedGoals:
      sport === "koripallo"
        ? "korkea"
        : homeXG + awayXG > 3.5
          ? "kohtalainen-korkea"
          : homeXG + awayXG < 2.2
            ? "matala"
            : "maltillinen",
    xgLabel,
    homeXG,
    awayXG,
    valueBets,
    bestBet,
    stats: {
      homeLast5: pickForm(seed % 13, 5),
      awayLast5: pickForm((seed % 13) + 7, 5),
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
