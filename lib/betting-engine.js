export function impliedProb(odds) {
  const n = Number(odds);
  if (!Number.isFinite(n) || n <= 1) return null;
  return 1 / n;
}

export function expectedValue(odds, probability) {
  const o = Number(odds);
  const p = Number(probability);
  if (!Number.isFinite(o) || !Number.isFinite(p)) return null;
  return o * p - 1;
}

export function kellyStake(probability, odds, bankroll = 1000, fraction = 0.25) {
  const p = Number(probability);
  const o = Number(odds);
  const b = Number(bankroll);

  if (!Number.isFinite(p) || !Number.isFinite(o) || !Number.isFinite(b)) return 0;
  if (p <= 0 || p >= 1 || o <= 1 || b <= 0) return 0;

  const kelly = (o * p - 1) / (o - 1);
  return Number(Math.max(0, kelly * b * fraction).toFixed(2));
}

function normalizeMarketProbs({ home, draw, away }) {
  const h = home || 0;
  const d = draw || 0;
  const a = away || 0;
  const total = h + d + a;

  if (!total) {
    return { home: 0.45, draw: 0.23, away: 0.32 };
  }

  return {
    home: h / total,
    draw: d / total,
    away: a / total,
  };
}

function modelProbabilities(match) {
  const market = normalizeMarketProbs({
    home: impliedProb(match?.bestOdds?.home),
    draw: impliedProb(match?.bestOdds?.draw),
    away: impliedProb(match?.bestOdds?.away),
  });

  const homeName = String(match?.home_team || "");
  const awayName = String(match?.away_team || "");

  let homeBoost = 0.015;
  let awayBoost = 0.005;

  if (homeName.length > awayName.length) homeBoost += 0.005;
  if (awayName.length > homeName.length) awayBoost += 0.005;

  const home = Math.max(0.02, Math.min(0.92, market.home + homeBoost));
  const draw = match?.bestOdds?.draw ? Math.max(0.02, Math.min(0.50, market.draw - 0.005)) : 0;
  const away = Math.max(0.02, Math.min(0.92, market.away + awayBoost));

  return normalizeMarketProbs({ home, draw, away });
}

export function analyzeRows(match, market = "h2h", bankroll = 1000) {
  if (!match || match.fixturesOnly) return [];

  const model = modelProbabilities(match);

  let rows = [];

  if (market === "totals") {
    rows = [
      { key: "over", label: `Over ${match.bestOdds?.point ?? "-"}`, odds: match.bestOdds?.over, model: 0.52 },
      { key: "under", label: `Under ${match.bestOdds?.point ?? "-"}`, odds: match.bestOdds?.under, model: 0.48 },
    ];
  } else if (market === "spreads") {
    rows = [
      {
        key: "spread-home",
        label: `${match.home_team} ${match.bestOdds?.spreadPointHome || ""}`,
        odds: match.bestOdds?.spreadHome,
        model: 0.52,
      },
      {
        key: "spread-away",
        label: `${match.away_team} ${match.bestOdds?.spreadPointAway || ""}`,
        odds: match.bestOdds?.spreadAway,
        model: 0.48,
      },
    ];
  } else {
    rows = [
      { key: "home", label: match.home_team, odds: match.bestOdds?.home, model: model.home },
      { key: "draw", label: "Tasapeli", odds: match.bestOdds?.draw, model: model.draw },
      { key: "away", label: match.away_team, odds: match.bestOdds?.away, model: model.away },
    ];
  }

  return rows
    .filter((row) => row.odds)
    .map((row) => {
      const marketProb = impliedProb(row.odds);
      const ev = expectedValue(row.odds, row.model);
      const edge = marketProb != null ? row.model - marketProb : null;
      const stake = kellyStake(row.model, row.odds, bankroll, 0.25);

      const shouldBet = edge > 0.025 && ev > 0 && stake > 0;
      const strength = edge >= 0.07 ? "Vahva" : edge >= 0.04 ? "Hyvä" : edge >= 0.025 ? "Pieni" : "Ei valuea";

      return {
        ...row,
        marketProb,
        modelProb: row.model,
        edge,
        ev,
        stake,
        shouldBet,
        strength,
      };
    });
}

export function getBestBets(matches = [], bankroll = 1000) {
  return matches
    .filter((match) => !match.fixturesOnly)
    .flatMap((match) =>
      analyzeRows(match, "h2h", bankroll).map((pick) => ({
        ...pick,
        match,
        id: `${match.id}-${pick.key}`,
      }))
    )
    .filter((pick) => pick.shouldBet)
    .sort((a, b) => b.edge - a.edge)
    .slice(0, 8);
}
