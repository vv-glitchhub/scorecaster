export function impliedProb(odds) {
  return odds ? 1 / odds : 0;
}

export function normalize(home, draw, away) {
  const total = home + draw + away;
  return {
    home: home / total,
    draw: draw / total,
    away: away / total,
  };
}

// 🔥 ALPHA MODEL (päivitettävissä myöhemmin)
export function modelProb(match) {
  const base = 0.45;
  const random = (Math.random() - 0.5) * 0.12;

  return {
    home: base + random,
    draw: 0.23,
    away: 1 - (base + random + 0.23),
  };
}

export function kelly(prob, odds, bankroll = 1000) {
  const edge = (odds * prob - 1) / (odds - 1);
  return Math.max(0, edge * bankroll * 0.25);
}

export function analyzeMatch(match) {
  const odds = match.bestOdds;

  const market = normalize(
    impliedProb(odds.home),
    impliedProb(odds.draw || 0.23),
    impliedProb(odds.away)
  );

  const model = modelProb(match);

  return {
    home: {
      market: market.home,
      model: model.home,
      edge: model.home - market.home,
      ev: odds.home * model.home - 1,
      stake: kelly(model.home, odds.home),
    },
    away: {
      market: market.away,
      model: model.away,
      edge: model.away - market.away,
      ev: odds.away * model.away - 1,
      stake: kelly(model.away, odds.away),
    },
  };
}

export function getDecision(match) {
  const result = analyzeMatch(match);

  const best =
    result.home.edge > result.away.edge ? "home" : "away";

  const pick = result[best];

  const confidence =
    pick.edge * 100 + pick.ev * 50;

  const shouldBet =
    pick.edge > 0.03 &&
    pick.ev > 0 &&
    confidence > 5;

  return {
    team: best === "home" ? match.home_team : match.away_team,
    edge: pick.edge,
    ev: pick.ev,
    stake: pick.stake,
    confidence,
    shouldBet,
    market: pick.market,
    model: pick.model,
  };
}
