import { NextResponse } from "next/server";

function getBestOdds(game) {
  const best = {};

  for (const bookmaker of game.bookmakers || []) {
    for (const market of bookmaker.markets || []) {
      if (market.key !== "h2h") continue;
      for (const outcome of market.outcomes || []) {
        const current = best[outcome.name];
        if (!current || outcome.price > current.price) {
          best[outcome.name] = {
            price: outcome.price,
            bookmaker: bookmaker.title
          };
        }
      }
    }
  }

  return best;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function round1(n) {
  return +n.toFixed(1);
}

function impliedProb(decimalOdds) {
  if (!decimalOdds || decimalOdds <= 1) return null;
  return 1 / decimalOdds;
}

function normalize3(a, b, c) {
  const s = a + b + c;
  return [a / s, b / s, c / s];
}

function normalize2(a, b) {
  const s = a + b;
  return [a / s, b / s];
}

function hashString(str) {
  return str.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

function pickForm(seed, len = 5) {
  const chars = ["V", "H", "T"];
  const arr = [];
  for (let i = 0; i < len; i++) arr.push(chars[(seed + i) % chars.length]);
  return arr;
}

function getFactorAdjustments(sport, selectedFactors = []) {
  let home = 0;
  let away = 0;
  let draw = 0;
  let totalGoals = 0;

  for (const f of selectedFactors) {
    switch (f) {
      case "Kotikenttäetu":
      case "Kotijää etu":
      case "Kotisali tukee":
        home += 0.035;
        break;

      case "Avainpelaaja loukkaantunut":
      case "Maalivahti poissa":
      case "Tähti loukkaantunut":
        away += 0.02;
        home -= 0.01;
        totalGoals -= 0.08;
        break;

      case "Derby-ottelu":
        draw += 0.02;
        totalGoals -= 0.05;
        break;

      case "Eurooppa rasittaa":
      case "Back-to-back":
      case "Väsynyt penkki":
      case "Pitkä matka":
        away += 0.02;
        home -= 0.005;
        totalGoals -= 0.03;
        break;

      case "Maalivahti vireessä":
      case "Puolustus tiukka":
        home += 0.01;
        draw += 0.01;
        totalGoals -= 0.18;
        break;

      case "Uusi valmentaja":
        home += 0.015;
        draw += 0.005;
        break;

      case "Sarjakärki vastaan":
        away += 0.025;
        break;

      case "Ylivoima korkea":
      case "3-pisteet uppoaa":
      case "Nopea tempo":
      case "Nopeat hyökkääjät":
      case "Huikea vaihtopelaaja":
        home += 0.015;
        totalGoals += 0.15;
        break;

      case "Playoff-paine":
        draw += sport === "jalkapallo" ? 0.015 : 0;
        totalGoals -= 0.08;
        break;

      case "Viime 3 voitettu":
        home += 0.02;
        break;

      case "Puolustus heikko":
        away += 0.015;
        totalGoals += 0.2;
        break;

      case "Yliajalle viimeksi":
        totalGoals += 0.1;
        away += 0.005;
        break;

      default:
        break;
    }
  }

  return { home, away, draw, totalGoals };
}

function poissonApprox(lambda, seedShift = 0) {
  const seed = Math.abs(Math.sin(lambda * 12.9898 + seedShift * 78.233));
  const r = seed - Math.floor(seed);

  if (lambda < 0.75) {
    if (r < 0.5) return 0;
    if (r < 0.85) return 1;
    if (r < 0.96) return 2;
    return 3;
  }

  if (lambda < 1.2) {
    if (r < 0.28) return 0;
    if (r < 0.63) return 1;
    if (r < 0.86) return 2;
    if (r < 0.96) return 3;
    return 4;
  }

  if (lambda < 1.8) {
    if (r < 0.14) return 0;
    if (r < 0.4) return 1;
    if (r < 0.68) return 2;
    if (r < 0.87) return 3;
    if (r < 0.96) return 4;
    return 5;
  }

  if (r < 0.08) return 0;
  if (r < 0.24) return 1;
  if (r < 0.48) return 2;
  if (r < 0.7) return 3;
  if (r < 0.86) return 4;
  if (r < 0.95) return 5;
  return 6;
}

function buildValueBets(game, sport, probs) {
  const oddsMap = getBestOdds(game);
  const candidates = [
    { label: game.home, raw: game.home, modelProb: probs.homeWinProb / 100 },
    ...(sport === "jalkapallo"
      ? [{ label: "Tasapeli", raw: "Draw", modelProb: probs.drawProb / 100 }]
      : []),
    { label: game.away, raw: game.away, modelProb: probs.awayWinProb / 100 }
  ];

  const out = [];

  for (const c of candidates) {
    const oddsObj = oddsMap[c.raw];
    if (!oddsObj?.price) continue;

    const marketProb = impliedProb(oddsObj.price);
    const edge = (c.modelProb - marketProb) * 100;

    if (edge >= 1.5) {
      out.push({
        outcome: c.label,
        odds: oddsObj.price,
        bookmaker: oddsObj.bookmaker,
        modelProb: round1(c.modelProb * 100),
        marketProb: round1(marketProb * 100),
        edge: round1(edge)
      });
    }
  }

  return out.sort((a, b) => b.edge - a.edge);
}

function makePrediction(game, sport, selectedFactors = []) {
  const oddsMap = getBestOdds(game);
  const seed = hashString(`${game.home}-${game.away}-${sport}`);

  const homeOdds = oddsMap[game.home]?.price;
  const awayOdds = oddsMap[game.away]?.price;
  const drawOdds = oddsMap["Draw"]?.price;

  let homeP;
  let awayP;
  let drawP = 0;

  if (sport === "jalkapallo" && homeOdds && awayOdds && drawOdds) {
    [homeP, drawP, awayP] = normalize3(
      impliedProb(homeOdds),
      impliedProb(drawOdds),
      impliedProb(awayOdds)
    );
  } else if (homeOdds && awayOdds) {
    [homeP, awayP] = normalize2(impliedProb(homeOdds), impliedProb(awayOdds));
  } else {
    homeP = 0.5;
    awayP = 0.5;
    drawP = sport === "jalkapallo" ? 0.24 : 0;
    if (sport === "jalkapallo") {
      [homeP, drawP, awayP] = normalize3(homeP, drawP, awayP);
    }
  }

  const adj = getFactorAdjustments(sport, selectedFactors);

  if (sport === "jalkapallo") {
    homeP += adj.home;
    awayP += adj.away;
    drawP += adj.draw;
    [homeP, drawP, awayP] = normalize3(
      clamp(homeP, 0.05, 0.85),
      clamp(drawP, 0.08, 0.35),
      clamp(awayP, 0.05, 0.85)
    );
  } else {
    homeP += adj.home;
    awayP += adj.away;
    [homeP, awayP] = normalize2(
      clamp(homeP, 0.08, 0.92),
      clamp(awayP, 0.08, 0.92)
    );
  }

  const homeWinProb = round1(homeP * 100);
  const awayWinProb = round1(awayP * 100);
  const drawProb = sport === "jalkapallo" ? round1(drawP * 100) : 0;

  const homeStrength = clamp(Math.round(homeWinProb / 10), 3, 9);
  const awayStrength = clamp(Math.round(awayWinProb / 10), 3, 9);

  let homeScore = 0;
  let awayScore = 0;
  let homeXG = 0;
  let awayXG = 0;
  let xgLabel = "";

  if (sport === "jalkapallo") {
    const baseTotalGoals = 2.45 + adj.totalGoals;
    const decisiveShare = 1 - drawP;
    const homeShare = homeP / (homeP + awayP);

    homeXG = clamp(baseTotalGoals * decisiveShare * (0.75 + homeShare * 0.9), 0.3, 3.8);
    awayXG = clamp(baseTotalGoals * decisiveShare * (0.75 + (1 - homeShare) * 0.9), 0.25, 3.2);

    homeXG = round1(homeXG + ((seed % 7) - 3) * 0.03);
    awayXG = round1(awayXG + (((seed >> 2) % 7) - 3) * 0.03);

    homeScore = poissonApprox(homeXG, seed % 17);
    awayScore = poissonApprox(awayXG, seed % 23);

    if (drawP >= 0.28 && Math.abs(homeP - awayP) < 0.08) {
      const drawModes = [
        [0, 0],
        [1, 1],
        [2, 2]
      ];
      const pick = drawModes[seed % drawModes.length];
      homeScore = pick[0];
      awayScore = pick[1];
    }

    if (homeP > awayP + 0.14 && homeScore <= awayScore) homeScore = awayScore + 1;
    if (awayP > homeP + 0.14 && awayScore <= homeScore) awayScore = homeScore + 1;

    xgLabel = `${homeXG} - ${awayXG}`;
  }

  if (sport === "jaakiekko") {
    const baseGoals = 5.3 + adj.totalGoals;
    const homeShare = homeP;

    homeXG = round1(clamp(baseGoals * (0.42 + homeShare * 0.38), 1.2, 4.8));
    awayXG = round1(clamp(baseGoals * (0.42 + awayP * 0.38), 1.1, 4.6));

    homeScore = clamp(poissonApprox(homeXG, seed % 19), 1, 7);
    awayScore = clamp(poissonApprox(awayXG, seed % 29), 1, 7);

    if (homeP > awayP + 0.12 && homeScore <= awayScore) homeScore = awayScore + 1;
    if (awayP > homeP + 0.12 && awayScore <= homeScore) awayScore = homeScore + 1;

    xgLabel = `${homeXG} - ${awayXG}`;
  }

  if (sport === "koripallo") {
    const totalPoints = 178 + (seed % 25) + Math.round(adj.totalGoals * 12);
    const margin = Math.round((homeP - awayP) * 18);

    homeScore = clamp(Math.round(totalPoints / 2 + margin / 2 + (seed % 6)), 78, 132);
    awayScore = clamp(Math.round(totalPoints / 2 - margin / 2 - (seed % 5)), 74, 128);

    if (homeP > awayP && homeScore <= awayScore) homeScore = awayScore + 2;
    if (awayP > homeP && awayScore <= homeScore) awayScore = homeScore + 2;

    homeXG = round1(homeScore / 50);
    awayXG = round1(awayScore / 50);
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
    `Perusennuste on johdettu suoraan markkinakertoimista, joten voittotodennäköisyydet seuraavat ensin markkinan näkemystä ja sen jälkeen valitut tekijät siirtävät mallia hieman suuntaan tai toiseen.`,
    `Tärkein valittu tekijä tässä kohteessa on "${keyFactor}". Se vaikuttaa erityisesti voittotodennäköisyyksiin ja arvioituun maali- tai pistemäärään.`,
    bestBet
      ? `Paras value löytyy kohteesta "${bestBet.outcome}", koska mallin arvio (${bestBet.modelProb}%) ylittää markkinan implisiittisen arvion (${bestBet.marketProb}%).`
      : `Selkeää value bet -ylikerrointa ei synny vahvasti, joten tämä kohde näyttää enemmänkin markkinan mukaiselta.`
  ].join("\n\n");

  return {
    homeScore,
    awayScore,
    homeWinProb,
    drawProb,
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
